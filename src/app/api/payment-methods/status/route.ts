import { connection, NextResponse } from 'next/server';
import {
  mercadoPagoPaymentConfig,
  paypalPaymentConfig,
  stripePaymentConfig,
} from '@/lib/payments/platform-config';

export async function GET() {
  await connection();
  const [mercadoPago, stripe, paypal] = await Promise.allSettled([
    mercadoPagoPaymentConfig(),
    stripePaymentConfig(),
    paypalPaymentConfig(),
  ]);

  // Availability can change after onboarding; never serve a stale "disconnected" state
  // from a shared CDN cache. These booleans include no credentials.
  return NextResponse.json(
    {
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
    },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
      },
    },
  );
}
