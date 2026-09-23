import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Faltan PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64',
  );

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error('❌ Error obteniendo token de PayPal:', {
      status: response.status,
      data,
    });

    throw new Error(
      data.error_description ||
        data.message ||
        'No se pudo autenticar con PayPal.',
    );
  }

  return data.access_token as string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    const sessionEmail = session?.user?.email;

    if (!sessionEmail) {
      return NextResponse.json(
        {
          message: 'No hay una sesión de usuario válida.',
        },
        {
          status: 401,
        },
      );
    }

    const body = await request.json();

    const paypalOrderId = body.paypalOrderId;

    const localOrderId = body.orderId;

    if (!paypalOrderId || !localOrderId) {
      return NextResponse.json(
        {
          message: 'Faltan paypalOrderId u orderId.',
        },
        {
          status: 400,
        },
      );
    }

    console.log('🔎 PAYPAL CAPTURE', {
      paypalOrderId,
      localOrderId,
      email: sessionEmail,
    });

    const dbUser = await prisma.user.findUnique({
      where: {
        email: sessionEmail.toLowerCase(),
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        {
          message: 'No se encontró el usuario.',
        },
        {
          status: 404,
        },
      );
    }

    const order = await prisma.order.findUnique({
      where: {
        id: localOrderId,
      },
    });

    if (!order) {
      console.error('❌ Orden local inexistente:', localOrderId);

      return NextResponse.json(
        {
          message: 'No se encontró la orden.',
        },
        {
          status: 404,
        },
      );
    }

    if (order.userId !== dbUser.id) {
      console.error('❌ La orden no pertenece al usuario:', {
        orderUserId: order.userId,
        sessionUserId: dbUser.id,
      });

      return NextResponse.json(
        {
          message: 'La orden no pertenece al usuario autenticado.',
        },
        {
          status: 403,
        },
      );
    }

    if (order.status === 'PAID') {
      return NextResponse.json(
        {
          success: true,
          message: 'La orden ya estaba pagada.',
          order,
        },
        {
          status: 200,
        },
      );
    }

    const accessToken = await getPayPalAccessToken();

    const captureResponse = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(
        paypalOrderId,
      )}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      },
    );

    const captureData = await captureResponse.json();

    console.log('📦 PAYPAL CAPTURE RESPONSE', {
      status: captureResponse.status,
      ok: captureResponse.ok,
      data: captureData,
    });

    if (!captureResponse.ok) {
      return NextResponse.json(
        {
          message:
            captureData.details?.[0]?.description ||
            captureData.message ||
            'PayPal rechazó la captura del pago.',
          paypal: captureData,
        },
        {
          status: 502,
        },
      );
    }

    if (captureData.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          message: `PayPal no completó el pago. Estado: ${captureData.status || 'desconocido'}.`,
          paypal: captureData,
        },
        {
          status: 400,
        },
      );
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: localOrderId,
      },
      data: {
        status: 'PAID',
      },
      include: {
        items: true,
      },
    });

    console.log('✅ ORDEN PAYPAL CONFIRMADA', {
      localOrderId,
      paypalOrderId,
      status: updatedOrder.status,
    });

    return NextResponse.json(
      {
        success: true,
        order: updatedOrder,
        paypalOrder: captureData,
      },
      {
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error('❌ Error en /api/paypal/capture-order:', error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Error interno al capturar el pago de PayPal.',
      },
      {
        status: 500,
      },
    );
  }
}
