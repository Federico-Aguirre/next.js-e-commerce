import { NextResponse } from 'next/server';
import { paypalAuthAssertion, paypalPaymentConfig } from '@/lib/payments/platform-config';

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { clientId, clientSecret, sellerMerchantId, partnerAttributionId, splitEnabled } =
    await paypalPaymentConfig();

  if (!clientId || !clientSecret || !sellerMerchantId || !splitEnabled) {
    return NextResponse.json(
      { message: 'PayPal está bloqueado hasta completar el onboarding sandbox del comercio.' },
      { status: 503 },
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    response_type: 'client_token',
    intent: 'sdk_init',
  });

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'PayPal-Auth-Assertion': paypalAuthAssertion(clientId, sellerMerchantId),
      ...(partnerAttributionId ? { 'PayPal-Partner-Attribution-Id': partnerAttributionId } : {}),
    },
    body: form,
    cache: 'no-store',
  });

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    console.error('PayPal client token error', {
      status: response.status,
      error: data.error,
      description: data.error_description,
    });
    return NextResponse.json(
      {
        message:
          data.error_description || data.error || 'No se pudo crear el client token de PayPal.',
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    clientId,
    clientToken: data.access_token,
    expiresIn: data.expires_in ?? 900,
  });
}
