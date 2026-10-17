import { NextResponse } from 'next/server';
import {
  mercadoPagoPaymentConfig,
  paypalPaymentConfig,
  stripePaymentConfig,
} from '@/lib/payments/platform-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [mercadoPago, stripe, paypal] = await Promise.allSettled([
    mercadoPagoPaymentConfig(),
    stripePaymentConfig(),
    paypalPaymentConfig(),
  ]);

  return NextResponse.json({
    sandbox: true,
    mercadoPago:
      mercadoPago.status === 'fulfilled' &&
      mercadoPago.value.chargeEnabled &&
      Boolean(mercadoPago.value.accessToken),
    stripe:
      stripe.status === 'fulfilled' &&
      stripe.value.splitEnabled &&
      Boolean(stripe.value.connectedAccountId),
    paypal:
      paypal.status === 'fulfilled' &&
      paypal.value.splitEnabled &&
      Boolean(paypal.value.sellerMerchantId),
  });
}
