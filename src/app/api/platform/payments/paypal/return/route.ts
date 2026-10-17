import { NextResponse } from 'next/server';
import {
  dashboardRedirect,
  isPlatformOwner,
  normalizeDashboardLocale,
  paypalPlatformAccessToken,
  requestOrigin,
} from '@/lib/payments/onboarding';
import {
  paypalHasThirdPartyConsent,
  paypalMerchantIsReady,
  type PayPalMerchantStatus,
} from '@/lib/payments/paypal-onboarding-status';
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
    const sellerMerchantId = url.searchParams.get('merchantIdInPayPal')?.trim();
    if (!sellerMerchantId) {
      throw new Error('PayPal no devolvió merchantIdInPayPal.');
    }

    const permissionsGranted = url.searchParams.get('permissionsGranted') === 'true';
    const consentStatus = url.searchParams.get('consentStatus') === 'true';
    const emailConfirmed = url.searchParams.get('isEmailConfirmed') === 'true';
    const businessAccount = url.searchParams.get('accountStatus') === 'BUSINESS_ACCOUNT';

    if (permissionsGranted && consentStatus && emailConfirmed && businessAccount) {
      await saveStorePaymentConnection({
        provider: 'PAYPAL',
        externalAccountId: sellerMerchantId,
        status: 'ACTIVE',
        metadata: {
          sandbox: true,
          verification: 'paypal_sandbox_return',
          permissionsGranted: true,
          consentStatus: true,
          primaryEmailConfirmed: true,
          businessAccount: true,
        },
      });

      return NextResponse.redirect(dashboardRedirect(origin, locale, 'paypal', 'connected'));
    }

    const platformMerchantId = process.env.DEVELOPER_PAYPAL_MERCHANT_ID?.trim();
    const platformClientId = process.env.DEVELOPER_PAYPAL_CLIENT_ID?.trim();
    const attributionId = process.env.DEVELOPER_PAYPAL_PARTNER_ATTRIBUTION_ID?.trim();
    if (!platformMerchantId || !platformClientId || !attributionId) {
      await saveStorePaymentConnection({
        provider: 'PAYPAL',
        externalAccountId: sellerMerchantId,
        status: 'REQUIRES_ACTION',
        metadata: { sandbox: true, verification: 'missing_platform_merchant_id' },
      });
      throw new Error('Falta DEVELOPER_PAYPAL_MERCHANT_ID para verificar el seller sandbox.');
    }

    const accessToken = await paypalPlatformAccessToken();
    const assertion = paypalAuthAssertion(platformClientId, platformMerchantId);
    const statusResponse = await fetch(
      `https://api-m.sandbox.paypal.com/v1/customer/partners/${encodeURIComponent(platformMerchantId)}/merchant-integrations/${encodeURIComponent(sellerMerchantId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Partner-Attribution-Id': attributionId,
          'PayPal-Auth-Assertion': assertion,
        },
        cache: 'no-store',
      },
    );
    const merchantStatus = (await statusResponse.json()) as PayPalMerchantStatus;

    if (!statusResponse.ok) {
      await saveStorePaymentConnection({
        provider: 'PAYPAL',
        externalAccountId: sellerMerchantId,
        status: 'REQUIRES_ACTION',
        metadata: {
          sandbox: true,
          verification: 'paypal_status_failed',
          statusCode: statusResponse.status,
        },
      });
      throw new Error(
        merchantStatus.message ||
          merchantStatus.name ||
          'PayPal no pudo verificar el seller sandbox.',
      );
    }

    const hasThirdPartyConsent = paypalHasThirdPartyConsent(merchantStatus);
    const active = paypalMerchantIsReady(merchantStatus);

    await saveStorePaymentConnection({
      provider: 'PAYPAL',
      externalAccountId: sellerMerchantId,
      status: active ? 'ACTIVE' : 'REQUIRES_ACTION',
      metadata: {
        sandbox: true,
        verification: 'paypal_api',
        paymentsReceivable: merchantStatus.payments_receivable ?? false,
        primaryEmailConfirmed: merchantStatus.primary_email_confirmed ?? false,
        thirdPartyConsent: hasThirdPartyConsent,
      },
    });

    return NextResponse.redirect(
      dashboardRedirect(origin, locale, 'paypal', active ? 'connected' : 'requires_action'),
    );
  } catch (error) {
    console.error('PayPal sandbox onboarding return error:', error);
    return NextResponse.redirect(dashboardRedirect(origin, locale, 'paypal', 'error'));
  }
}
