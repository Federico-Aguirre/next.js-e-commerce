import { randomUUID } from 'crypto';

import { MercadoPagoConfig, Order } from 'mercadopago';
import { NextResponse } from 'next/server';

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error('Falta la variable de entorno MERCADOPAGO_ACCESS_TOKEN.');
}

const client = new MercadoPagoConfig({
  accessToken,
  options: {
    timeout: 10000,
  },
});

const order = new Order(client);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.token) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Falta el token de tarjeta generado por el navegador.',
        },
        { status: 400 },
      );
    }

    // 🛠️ PARSEO ROBUSTO DEL MONTO: reemplaza comas por puntos y convierte a float
    let rawAmount = body.transaction_amount;
    if (typeof rawAmount === 'string') {
      rawAmount = rawAmount.replace(',', '.').trim();
    }
    const amount = parseFloat(String(rawAmount));

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'El monto de la transacción no es válido.',
        },
        { status: 400 },
      );
    }

    const cleanAmount = Number(amount.toFixed(2));
    const installments = Number(body.installments || 1);

    if (!Number.isInteger(installments) || installments < 1) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'La cantidad de cuotas no es válida.',
        },
        { status: 400 },
      );
    }

    const payerEmail = body.email || 'test@testuser.com';
    const paymentMethodId = body.payment_method_id || 'master';

    const orderResponse = await order.create({
      body: {
        type: 'online',
        processing_mode: 'automatic',

        total_amount: cleanAmount.toFixed(2),

        external_reference: `checkout-${randomUUID()}`,

        payer: {
          email: payerEmail,
        },

        transactions: {
          payments: [
            {
              amount: cleanAmount.toFixed(2),

              payment_method: {
                id: paymentMethodId,
                type: 'credit_card',
                token: body.token,
                installments,
              },
            },
          ],
        },
      },

      requestOptions: {
        idempotencyKey: randomUUID(),
      },
    });

    const payment = orderResponse?.transactions?.payments?.[0];

    return NextResponse.json({
      status: payment?.status || orderResponse?.status || 'unknown',
      status_detail:
        payment?.status_detail || orderResponse?.status_detail || null,

      id: payment?.id || null,

      order_id: orderResponse?.id || null,

      order_status: orderResponse?.status || null,
    });
  } catch (error: any) {
    console.error('=== MERCADO PAGO ORDER ERROR ===');
    console.error(error);

    const statusCode = typeof error?.status === 'number' ? error.status : 500;

    return NextResponse.json(
      {
        status: 'error',

        message: error?.message || 'Error interno al crear la order.',

        causes: error?.cause || error?.causes || null,
      },
      {
        status: statusCode,
      },
    );
  }
}
