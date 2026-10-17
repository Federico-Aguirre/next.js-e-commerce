import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  dashboardRedirect,
  isPlatformOwner,
  normalizeDashboardLocale,
  paypalPlatformAccessToken,
  requestOrigin,
} from '@/lib/payments/onboarding';
import { paypalAuthAssertion } from '@/lib/payments/platform-config';
import { saveStorePaymentConnection } from '@/lib/payments/store-connections';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = normalizeDashboardLocale(url.searchParams.get('locale'));
  const origin = requestOrigin(request);

  if (!(await isPlatformOwner())) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, origin));
  }

  try {
    const attributionId = process.env.DEVELOPER_PAYPAL_PARTNER_ATTRIBUTION_ID?.trim();
    const platformClientId = process.env.DEVELOPER_PAYPAL_CLIENT_ID?.trim();
    const platformMerchantId = process.env.DEVELOPER_PAYPAL_MERCHANT_ID?.trim();
    if (!attributionId || !platformClientId || !platformMerchantId) {
      throw new Error('Faltan credenciales de partner PayPal sandbox para iniciar el onboarding.');
    }

    const accessToken = await paypalPlatformAccessToken();
    const trackingId = `store-default-${randomUUID()}`;
    const returnUrl = new URL('/api/platform/payments/paypal/return', origin);
    returnUrl.searchParams.set('locale', locale);

    const response = await fetch('https://api-m.sandbox.paypal.com/v2/customer/partner-referrals', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Partner-Attribution-Id': attributionId,
        'PayPal-Auth-Assertion': paypalAuthAssertion(platformClientId, platformMerchantId),
      },
      body: JSON.stringify({
        tracking_id: trackingId,
        partner_config_override: {
          return_url: returnUrl.toString(),
          return_url_description: 'Volver al panel de la tienda',
        },
        operations: [
          {
            operation: 'API_INTEGRATION',
            api_integration_preference: {
              rest_api_integration: {
                integration_method: 'PAYPAL',
                integration_type: 'THIRD_PARTY',
                third_party_details: {
                  features: ['PAYMENT', 'REFUND', 'PARTNER_FEE'],
                },
              },
            },
          },
        ],
        products: ['EXPRESS_CHECKOUT'],
        legal_consents: [{ type: 'SHARE_DATA_CONSENT', granted: true }],
      }),
      cache: 'no-store',
    });

    const data = (await response.json()) as {
      links?: Array<{ href?: string; rel?: string }>;
      name?: string;
      message?: string;
      details?: Array<{ description?: string }>;
    };
    const actionUrl = data.links?.find((link) => link.rel === 'action_url')?.href;
    const selfUrl = data.links?.find((link) => link.rel === 'self')?.href;

    if (!response.ok || !actionUrl) {
      throw new Error(
        data.details?.[0]?.description ||
          data.message ||
          data.name ||
          'PayPal no creó el onboarding.',
      );
    }

    await saveStorePaymentConnection({
      provider: 'PAYPAL',
      status: 'PENDING',
      metadata: {
        sandbox: true,
        trackingId,
        referralUrl: selfUrl ?? '',
        returnUrl: returnUrl.toString(),
      },
    });

    return NextResponse.redirect(actionUrl);
  } catch (error) {
    console.error('PayPal sandbox onboarding error:', error);
    return NextResponse.redirect(dashboardRedirect(origin, locale, 'paypal', 'error'));
  }
}
