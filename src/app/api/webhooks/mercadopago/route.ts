import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextResponse } from 'next/server';
import { mercadoPagoPaymentConfig } from '@/lib/payments/platform-config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { accessToken } = await mercadoPagoPaymentConfig();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Falta configurar Mercado Pago del comercio.' },
        { status: 500 },
      );
    }

    const client = new MercadoPagoConfig({
      accessToken,
    });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('data.id'); // ID de operación que nos manda MP

    // 🔒 Validamos directo con Mercado Pago de Servidor a Servidor
    if (type === 'payment' && id) {
      const paymentClient = new Payment(client);
      const mpPaymentInfo = await paymentClient.get({ id: Number(id) });

      // Si el pago es real y está aprobado en sus servidores...
      if (mpPaymentInfo.status === 'approved') {
        // Nota: En producción, acá es donde crearías la orden directamente por detrás.
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    console.error('❌ Error en el Webhook de Mercado Pago:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
