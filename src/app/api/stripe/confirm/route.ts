import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import StripeSDK from 'stripe';
import { authOptions } from '@/lib/auth-options';
import { sendLowStockAlerts, sendPaidOrderAlert } from '@/lib/order-alerts';
import { sendOrderConfirmationEmail } from '@/lib/orders/order-confirmation-email';
import { stripePaymentConfig } from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { secretKey: stripeSecretKey } = await stripePaymentConfig();

    if (!stripeSecretKey) {
      console.error('❌ Stripe no está configurado.');
      return NextResponse.json(
        {
          message: 'Error de configuración en el servidor de pagos.',
        },
        {
          status: 500,
        },
      );
    }

    // Instanciación diferida (Lazy) usando StripeSDK
    const stripe = new StripeSDK(stripeSecretKey);

    const session = await getServerSession(authOptions);

    const sessionEmail = session?.user?.email;

    if (!sessionEmail) {
      return NextResponse.json(
        {
          message: 'Debés iniciar sesión para confirmar la compra.',
        },
        {
          status: 401,
        },
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        email: sessionEmail.toLowerCase(),
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        {
          message: 'No se encontró el usuario en la base de datos.',
        },
        {
          status: 404,
        },
      );
    }

    const userId = dbUser.id;

    const body = await request.json();

    const { paymentIntentId, orderId } = body as {
      paymentIntentId: string;
      orderId: string;
    };

    if (!paymentIntentId || !orderId) {
      return NextResponse.json(
        {
          message: 'Faltan datos para confirmar la compra.',
        },
        {
          status: 400,
        },
      );
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        {
          message: 'El pago de Stripe no fue completado.',
          status: paymentIntent.status,
        },
        {
          status: 400,
        },
      );
    }

    if (paymentIntent.metadata.orderId !== orderId) {
      return NextResponse.json(
        {
          message: 'La orden no coincide con el pago.',
        },
        {
          status: 400,
        },
      );
    }

    if (paymentIntent.metadata.userId !== userId) {
      return NextResponse.json(
        {
          message: 'El usuario no coincide con el pago.',
        },
        {
          status: 403,
        },
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      return NextResponse.json(
        {
          message: 'No se encontró la orden.',
        },
        {
          status: 404,
        },
      );
    }

    if (order.status === 'PAID') {
      await sendOrderConfirmationEmail(order.id);
      return NextResponse.json({
        success: true,
        orderId: order.id,
        alreadyConfirmed: true,
      });
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { message: 'La reserva ya no está disponible para confirmar.' },
        { status: 409 },
      );
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        status: 'PAID',
        paymentProvider: 'STRIPE',
        paymentExternalId: paymentIntent.id,
      },
    });

    await sendOrderConfirmationEmail(updatedOrder.id);
    void sendPaidOrderAlert(updatedOrder.id);
    await sendLowStockAlerts();

    return NextResponse.json({
      success: true,
      orderId: updatedOrder.id,
    });
  } catch (error: unknown) {
    console.error('❌ Error confirmando pago Stripe:', error);

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Error interno al confirmar el pago.',
      },
      {
        status: 500,
      },
    );
  }
}
