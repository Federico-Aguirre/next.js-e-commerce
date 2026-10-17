import 'server-only';
import { paypalPlatformAccessToken } from '@/lib/payments/onboarding';
import {
  getStorePaymentConnection,
  saveStorePaymentConnection,
} from '@/lib/payments/store-connections';

export type PayPalMerchantStatus = {
  merchant_id?: string;
  tracking_id?: string;
  payments_receivable?: boolean;
  primary_email_confirmed?: boolean;
  oauth_third_party?: Array<unknown>;
  oauth_integrations?: Array<{
    oauth_third_party?: Array<unknown>;
  }>;
  products?: Array<{ name?: string; vetting_status?: string; status?: string }>;
  capabilities?: Array<{ name?: string; status?: string }>;
  message?: string;
  name?: string;
};

function paypalAuthAssertion(clientId: string, sellerMerchantId: string) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/=+$/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  return `${encode({ alg: 'none' })}.${encode({ iss: clientId, payer_id: sellerMerchantId })}.`;
}

export function paypalHasThirdPartyConsent(status: PayPalMerchantStatus) {
  if ((status.oauth_third_party?.length ?? 0) > 0) return true;
  return (status.oauth_integrations ?? []).some(
    (integration) => (integration.oauth_third_party?.length ?? 0) > 0,
  );
}

export function paypalMerchantIsReady(status: PayPalMerchantStatus) {
  return (
    status.payments_receivable === true &&
    status.primary_email_confirmed === true &&
    paypalHasThirdPartyConsent(status)
  );
}

export async function reconcilePendingPayPalConnection() {
  const connection = await getStorePaymentConnection('PAYPAL');
  if (!connection || connection.status === 'ACTIVE') return connection?.status ?? null;
  if (connection.status !== 'PENDING' && connection.status !== 'REQUIRES_ACTION') {
    return connection.status;
  }

  const metadata =
    connection.metadata &&
    typeof connection.metadata === 'object' &&
    !Array.isArray(connection.metadata)
      ? connection.metadata
      : {};
  const trackingId = typeof metadata.trackingId === 'string' ? metadata.trackingId : undefined;
  const platformMerchantId = process.env.DEVELOPER_PAYPAL_MERCHANT_ID?.trim();
  const platformClientId = process.env.DEVELOPER_PAYPAL_CLIENT_ID?.trim();
  const attributionId = process.env.DEVELOPER_PAYPAL_PARTNER_ATTRIBUTION_ID?.trim();

  if (!trackingId || !platformMerchantId || !platformClientId || !attributionId) {
    return connection.status;
  }

  try {
    const accessToken = await paypalPlatformAccessToken();
    let sellerMerchantId = connection.externalAccountId ?? undefined;

    if (!sellerMerchantId) {
      const lookupResponse = await fetch(
        `https://api-m.sandbox.paypal.com/v1/customer/partners/${encodeURIComponent(platformMerchantId)}/merchant-integrations?tracking_id=${encodeURIComponent(trackingId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Partner-Attribution-Id': attributionId,
            'PayPal-Auth-Assertion': paypalAuthAssertion(platformClientId, platformMerchantId),
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!lookupResponse.ok) return connection.status;
      const lookup = (await lookupResponse.json()) as PayPalMerchantStatus;
      sellerMerchantId = lookup.merchant_id?.trim();
      if (!sellerMerchantId) return connection.status;
    }

    const statusResponse = await fetch(
      `https://api-m.sandbox.paypal.com/v1/customer/partners/${encodeURIComponent(platformMerchantId)}/merchant-integrations/${encodeURIComponent(sellerMerchantId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Partner-Attribution-Id': attributionId,
          'PayPal-Auth-Assertion': paypalAuthAssertion(platformClientId, platformMerchantId),
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!statusResponse.ok) return connection.status;

    const merchantStatus = (await statusResponse.json()) as PayPalMerchantStatus;
    const active = paypalMerchantIsReady(merchantStatus);
    const nextStatus = active ? 'ACTIVE' : 'REQUIRES_ACTION';

    await saveStorePaymentConnection({
      provider: 'PAYPAL',
      externalAccountId: sellerMerchantId,
      status: nextStatus,
      metadata: {
        sandbox: true,
        trackingId,
        verification: 'paypal_tracking_api',
        paymentsReceivable: merchantStatus.payments_receivable ?? false,
        primaryEmailConfirmed: merchantStatus.primary_email_confirmed ?? false,
        thirdPartyConsent: paypalHasThirdPartyConsent(merchantStatus),
      },
    });

    return nextStatus;
  } catch (error) {
    console.error('No se pudo reconciliar el onboarding sandbox de PayPal.', error);
    return connection.status;
  }
}
