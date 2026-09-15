import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.token) {
      return NextResponse.json(
        { status: 'error', message: 'Falta el token generado por el navegador.' },
        { status: 400 }
      );
    }

    const payment = new Payment(client);
    const paymentResponse = await payment.create({
      body: {
        transaction_amount: Number(body.transaction_amount),
        token: body.token,
        description: body.description || "Prueba de pago directo",
        installments: Number(body.installments || 1),
        payment_method_id: body.payment_method_id || 'master',
        payer: {
          email: body.email || "comprador_test@gmail.com",
          identification: {
            type: body.docType || 'DNI',
            number: body.docNumber || '12345678',
          },
        },
      },
    });

    return NextResponse.json({
      status: paymentResponse.status,
      status_detail: paymentResponse.status_detail,
      id: paymentResponse.id,
    });
  } catch (error: any) {
    console.error('Error al procesar pago en backend:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Error interno en la transacción.',
      },
      { status: 500 }
    );
  }
}