import { MercadoPagoConfig, Order } from 'mercadopago';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { sendLowStockAlerts, sendPaidOrderAlert } from '@/lib/order-alerts';
import { sendOrderConfirmationEmail } from '@/lib/orders/order-confirmation-email';
import { mercadoPagoPaymentConfig } from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';

interface OrderItemInput {
  id?: string;
  articleId?: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
  size?: string;
  colorName?: string;
}

interface ConfirmOrderBody {
  paymentId: string;
  orderId: string;
  items: OrderItemInput[];
  total: number;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        {
          message: 'Debés iniciar sesión para confirmar la orden.',
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as ConfirmOrderBody;

    const { paymentId, orderId, items, total } = body;

    if (!paymentId || !orderId || !items || items.length === 0 || typeof total !== 'number') {
      return NextResponse.json(
        {
          message: 'Datos incompletos.',
        },
        { status: 400 },
      );
    }

    // Verificar la Order directamente con Mercado Pago.
    const { accessToken } = await mercadoPagoPaymentConfig();
    if (!accessToken) {
      return NextResponse.json(
        { message: 'Falta configurar Mercado Pago del comercio.' },
        { status: 500 },
      );
    }
    const client = new MercadoPagoConfig({ accessToken });
    const orderClient = new Order(client);

    const mercadoPagoOrder = await orderClient.get({
      id: orderId,
    });

    const payment = mercadoPagoOrder.transactions?.payments?.[0];

    if (
      mercadoPagoOrder.status !== 'processed' ||
      payment?.status !== 'processed' ||
      payment?.status_detail !== 'accredited'
    ) {
      return NextResponse.json(
        {
          message: 'El pago no fue acreditado.',
          orderStatus: mercadoPagoOrder.status,
          paymentStatus: payment?.status,
          paymentStatusDetail: payment?.status_detail,
        },
        { status: 400 },
      );
    }

    // Evitar crear dos veces la misma orden.
    const existingOrder = await prisma.order.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (existingOrder) {
      if (existingOrder.status === 'PAID') {
        await sendOrderConfirmationEmail(existingOrder.id);
      }
      return NextResponse.json(existingOrder, { status: 200 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!dbUser) {
      return NextResponse.json({ message: 'No se encontró el usuario.' }, { status: 404 });
    }

    const fechaExpiracion = new Date();

    fechaExpiracion.setDate(fechaExpiracion.getDate() + 7);

    const nuevaOrden = await prisma.order.create({
      data: {
        id: paymentId,
        userId,
        total: Number(total),
        status: 'PAID',
        paymentProvider: 'MERCADOPAGO',
        paymentExternalId: paymentId,
        expiresAt: fechaExpiracion,
        deliveryFirstName: dbUser.firstName,
        deliveryLastName: dbUser.lastName,
        deliveryPhone: dbUser.phone,
        deliveryDni: dbUser.dni,
        deliveryStreet: dbUser.shippingStreet,
        deliveryNumber: dbUser.shippingNumber,
        deliveryApartment: dbUser.shippingApartment,
        deliveryCity: dbUser.shippingCity,
        deliveryProvince: dbUser.shippingProvince,
        deliveryPostalCode: dbUser.shippingPostalCode,
        deliveryCountry: dbUser.shippingCountry,

        items: {
          create: items.map((item) => ({
            productId: String(item.articleId || item.id || 'manual-id'),

            title: item.title,
            price: Number(item.price),
            quantity: Number(item.quantity),

            image: item.image || '',

            size: item.size || 'M',
          })),
        },
      } as any,

      include: {
        items: true,
      },
    });

    await sendOrderConfirmationEmail(nuevaOrden.id);
    void sendPaidOrderAlert(nuevaOrden.id);
    await sendLowStockAlerts();

    return NextResponse.json(nuevaOrden, { status: 201 });
  } catch (error: unknown) {
    console.error('❌ Error confirmando la orden:', error);

    const message = error instanceof Error ? error.message : 'Error interno del servidor.';

    return NextResponse.json(
      {
        message: 'No se pudo confirmar la orden.',
        error: message,
      },
      { status: 500 },
    );
  }
}
