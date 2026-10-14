import 'server-only';

const LEGACY_PERCENT = 10;

export function platformCommissionPercent() {
  const value = Number(process.env.DEVELOPER_COMMISSION_PERCENT ?? LEGACY_PERCENT);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : LEGACY_PERCENT;
}

export function platformFee(amount: number) {
  return Number((amount * (platformCommissionPercent() / 100)).toFixed(2));
}

export function mercadoPagoPaymentConfig() {
  const sellerOauthToken = process.env.STORE_MERCADOPAGO_OAUTH_ACCESS_TOKEN?.trim();
  const sellerLegacyToken =
    process.env.STORE_MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  const accessToken = sellerOauthToken || sellerLegacyToken;
  const splitEnabled = Boolean(
    sellerOauthToken &&
    process.env.DEVELOPER_MERCADOPAGO_CLIENT_ID &&
    process.env.DEVELOPER_MERCADOPAGO_CLIENT_SECRET,
  );

  return { accessToken, splitEnabled };
}

export function stripePaymentConfig() {
  const platformSecretKey = process.env.DEVELOPER_STRIPE_SECRET_KEY?.trim();
  const connectedAccountId = process.env.STORE_STRIPE_CONNECTED_ACCOUNT_ID?.trim();
  const legacySecretKey =
    process.env.STORE_STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
  const splitEnabled = Boolean(platformSecretKey && connectedAccountId);

  return {
    secretKey: splitEnabled ? platformSecretKey : legacySecretKey,
    connectedAccountId: splitEnabled ? connectedAccountId : undefined,
    splitEnabled,
  };
}

export function paypalPaymentConfig() {
  const platformClientId = process.env.DEVELOPER_PAYPAL_CLIENT_ID?.trim();
  const platformClientSecret = process.env.DEVELOPER_PAYPAL_CLIENT_SECRET?.trim();
  const sellerMerchantId = process.env.STORE_PAYPAL_MERCHANT_ID?.trim();
  const partnerAttributionId = process.env.DEVELOPER_PAYPAL_PARTNER_ATTRIBUTION_ID?.trim();
  const legacyClientId =
    process.env.STORE_PAYPAL_CLIENT_ID?.trim() || process.env.PAYPAL_CLIENT_ID?.trim();
  const legacyClientSecret =
    process.env.STORE_PAYPAL_CLIENT_SECRET?.trim() || process.env.PAYPAL_CLIENT_SECRET?.trim();
  const splitEnabled = Boolean(platformClientId && platformClientSecret && sellerMerchantId);

  return {
    clientId: splitEnabled ? platformClientId : legacyClientId,
    clientSecret: splitEnabled ? platformClientSecret : legacyClientSecret,
    sellerMerchantId: splitEnabled ? sellerMerchantId : undefined,
    partnerAttributionId: splitEnabled ? partnerAttributionId : undefined,
    splitEnabled,
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
