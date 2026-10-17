import { NextResponse } from 'next/server';
import { mercadoPagoPaymentConfig } from '@/lib/payments/platform-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await mercadoPagoPaymentConfig();
  const publicKey = config.splitEnabled
    ? process.env.NEXT_PUBLIC_DEVELOPER_MERCADOPAGO_PUBLIC_KEY?.trim()
    : process.env.NEXT_PUBLIC_STORE_MERCADOPAGO_PUBLIC_KEY?.trim();

  if (!config.chargeEnabled || !config.accessToken || !publicKey) {
    return NextResponse.json(
      { message: 'Mercado Pago no tiene una configuración de cobro completa.' },
      { status: 503 },
    );
  }

  return NextResponse.json({
    publicKey,
    mode: config.splitEnabled ? 'split' : 'standalone',
  });
}
