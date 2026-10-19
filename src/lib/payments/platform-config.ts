import 'server-only';
import Stripe from 'stripe';
import { roundCurrencyAmount } from '@/lib/currency/currencies';
import { StoreConfig } from '@/utils/StoreConfig';
import { paypalMerchantIsReady, type PayPalMerchantStatus } from './paypal-onboarding-status';
import { getStorePaymentConnection, saveStorePaymentConnection } from './store-connections';

const DEFAULT_COMMISSION_PERCENT = 10;

export function platformCommissionPercent() {
  const value = Number(process.env.DEVELOPER_COMMISSION_PERCENT ?? DEFAULT_COMMISSION_PERCENT);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : DEFAULT_COMMISSION_PERCENT;
}

export function platformFee(amount: number) {
  return roundCurrencyAmount(amount * (platformCommissionPercent() / 100), StoreConfig.currency);
}

export function commissionableProductSubtotal(items: Array<{ price: number; quantity: number }>) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  return roundCurrencyAmount(subtotal, StoreConfig.currency);
}

export function platformFeeForProducts(items: Array<{ price: number; quantity: number }>) {
  return platformFee(commissionableProductSubtotal(items));
}

function connectionCanCharge(status: string | null | undefined) {
  return !status || status === 'CONNECTED' || status === 'ACTIVE';
}

async function refreshMercadoPagoTokenIfNeeded() {
  const connection = await getStorePaymentConnection('MERCADOPAGO');
  if (!connection?.accessToken || !connectionCanCharge(connection.status)) return connection;

  const expiresSoon =
    connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() <= Date.now() + 5 * 60 * 1000;
  if (!expiresSoon || !connection.refreshToken) return connection;

  const clientId = process.env.DEVELOPER_MERCADOPAGO_CLIENT_ID?.trim();
  const clientSecret = process.env.DEVELOPER_MERCADOPAGO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return connection;

  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    }),
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error('No se pudo renovar el token OAuth de Mercado Pago.', data);
    await saveStorePaymentConnection({ provider: 'MERCADOPAGO', status: 'REQUIRES_ACTION' });
    return getStorePaymentConnection('MERCADOPAGO');
  }

  await saveStorePaymentConnection({
    provider: 'MERCADOPAGO',
    externalAccountId: String(data.user_id ?? connection.externalAccountId ?? ''),
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : connection.refreshToken,
    tokenExpiresAt: data.expires_in
      ? new Date(Date.now() + Number(data.expires_in) * 1000)
      : connection.tokenExpiresAt,
    status: 'CONNECTED',
    metadata: {
      sandbox: true,
      publicKey: data.public_key ?? null,
      scope: data.scope ?? null,
      liveMode: data.live_mode ?? false,
    },
  });

  return getStorePaymentConnection('MERCADOPAGO');
}

export async function mercadoPagoPaymentConfig() {
  const connection = await refreshMercadoPagoTokenIfNeeded();
  const storedOauthToken = connectionCanCharge(connection?.status)
    ? connection?.accessToken
    : undefined;
  const standaloneToken = process.env.STORE_MERCADOPAGO_ACCESS_TOKEN?.trim();

  // El split sólo se activa con un token OAuth vigente guardado después del onboarding.
  // No usamos tokens OAuth estáticos de entorno para evitar credenciales obsoletas.
  const oauthToken = storedOauthToken;
  const accessToken = oauthToken || standaloneToken;
  const splitEnabled = Boolean(
    oauthToken &&
    process.env.DEVELOPER_MERCADOPAGO_CLIENT_ID?.trim() &&
    process.env.DEVELOPER_MERCADOPAGO_CLIENT_SECRET?.trim(),
  );
  const standaloneEnabled = Boolean(!oauthToken && standaloneToken);

  return {
    accessToken,
    chargeEnabled: Boolean(accessToken),
    splitEnabled,
    standaloneEnabled,
    externalAccountId: connection?.externalAccountId,
    sandbox: true,
  };
}

export async function stripePaymentConfig() {
  const connection = await getStorePaymentConnection('STRIPE');
  const platformSecretKey = process.env.DEVELOPER_STRIPE_SECRET_KEY?.trim();
  const connectedAccountId = connectionCanCharge(connection?.status)
    ? connection?.externalAccountId || process.env.STORE_STRIPE_CONNECTED_ACCOUNT_ID?.trim()
    : undefined;
  const sandboxKey = Boolean(platformSecretKey?.startsWith('sk_test_'));
  let accountReady = false;

  if (platformSecretKey && connectedAccountId && sandboxKey) {
    try {
      const stripe = new Stripe(platformSecretKey);
      const account = await stripe.v2.core.accounts.retrieve(connectedAccountId, {
        include: ['configuration.recipient'],
      });
      const transferStatus =
        account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
      accountReady = !account.livemode && !account.closed && transferStatus === 'active';
    } catch (error) {
      console.error('No se pudo validar la cuenta Connect de Stripe.', error);
    }
  }

  return {
    secretKey: sandboxKey ? platformSecretKey : undefined,
    connectedAccountId: accountReady ? connectedAccountId : undefined,
    splitEnabled: Boolean(platformSecretKey && connectedAccountId && sandboxKey && accountReady),
    sandbox: true,
  };
}

async function paypalSellerIsActive(input: {
  clientId: string;
  clientSecret: string;
  platformMerchantId: string;
  sellerMerchantId: string;
  partnerAttributionId: string;
}) {
  try {
    const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${input.clientId}:${input.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
    });
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenResponse.ok || !tokenData.access_token) return false;

    const statusResponse = await fetch(
      `https://api-m.sandbox.paypal.com/v1/customer/partners/${encodeURIComponent(input.platformMerchantId)}/merchant-integrations/${encodeURIComponent(input.sellerMerchantId)}`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
          'PayPal-Partner-Attribution-Id': input.partnerAttributionId,
          'PayPal-Auth-Assertion': paypalAuthAssertion(input.clientId, input.platformMerchantId),
        },
        cache: 'no-store',
      },
    );
    if (!statusResponse.ok) return false;
    const status = (await statusResponse.json()) as PayPalMerchantStatus;
    return paypalMerchantIsReady(status);
  } catch (error) {
    console.error('No se pudo validar el seller sandbox de PayPal.', error);
    return false;
  }
}

export async function paypalPaymentConfig() {
  const connection = await getStorePaymentConnection('PAYPAL');
  const platformClientId = process.env.DEVELOPER_PAYPAL_CLIENT_ID?.trim();
  const platformClientSecret = process.env.DEVELOPER_PAYPAL_CLIENT_SECRET?.trim();
  const platformMerchantId = process.env.DEVELOPER_PAYPAL_MERCHANT_ID?.trim();
  const partnerAttributionId = process.env.DEVELOPER_PAYPAL_PARTNER_ATTRIBUTION_ID?.trim();
  const sellerMerchantId = connectionCanCharge(connection?.status)
    ? connection?.externalAccountId || process.env.STORE_PAYPAL_MERCHANT_ID?.trim()
    : undefined;
  const sandboxEnabled =
    process.env.PAYPAL_ENVIRONMENT !== 'production' &&
    process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT !== 'production';

  let sellerActive = false;
  if (
    sandboxEnabled &&
    platformClientId &&
    platformClientSecret &&
    platformMerchantId &&
    partnerAttributionId &&
    sellerMerchantId
  ) {
    sellerActive = await paypalSellerIsActive({
      clientId: platformClientId,
      clientSecret: platformClientSecret,
      platformMerchantId,
      sellerMerchantId,
      partnerAttributionId,
    });

    if (connection?.externalAccountId === sellerMerchantId && !sellerActive) {
      await saveStorePaymentConnection({ provider: 'PAYPAL', status: 'REQUIRES_ACTION' });
    }
  }

  const splitEnabled = Boolean(
    sandboxEnabled &&
    platformClientId &&
    platformClientSecret &&
    platformMerchantId &&
    partnerAttributionId &&
    sellerMerchantId &&
    sellerActive,
  );

  return {
    clientId: sandboxEnabled ? platformClientId : undefined,
    clientSecret: sandboxEnabled ? platformClientSecret : undefined,
    sellerMerchantId: splitEnabled ? sellerMerchantId : undefined,
    partnerAttributionId: splitEnabled ? partnerAttributionId : undefined,
    splitEnabled,
    sandbox: true,
  };
}

export function paypalAuthAssertion(clientId: string, sellerMerchantId: string) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/=+$/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  return `${encode({ alg: 'none' })}.${encode({ iss: clientId, payer_id: sellerMerchantId })}.`;
}
