import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Falta la variable de entorno MERCADOPAGO_ACCESS_TOKEN.' },
        { status: 500 },
      );
    }

    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    const body = await req.json();

    const paymentResponse = await payment.create({
      body: {
        transaction_amount: body.transaction_amount,
        token: body.token,
        description: body.description,
        installments: body.installments,
        payment_method_id: body.payment_method_id,
        payer: {
          email: body.payer?.email,
          identification: body.payer?.identification,
        },
      },
    });

    return NextResponse.json(paymentResponse);
  } catch (error: any) {
    console.error('Error procesando pago:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al procesar el pago' },
      { status: 400 },
    );
  }
}
