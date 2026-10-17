import 'server-only';
import Stripe from 'stripe';
import {
  mercadoPagoPaymentConfig,
  paypalAuthAssertion,
  paypalPaymentConfig,
  stripePaymentConfig,
} from '@/lib/payments/platform-config';

export type PaymentProvider = 'MERCADOPAGO' | 'STRIPE' | 'PAYPAL';

export type RefundResult = { externalId: string; status: string };

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`Falta ${name} para procesar el reembolso.`);
  return value;
}

async function refundStripe(paymentIntentId: string, orderId: string): Promise<RefundResult> {
  const config = await stripePaymentConfig();
  const stripe = new Stripe(required(config.secretKey, 'Stripe'));
  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      ...(config.splitEnabled ? { refund_application_fee: true, reverse_transfer: true } : {}),
    },
    { idempotencyKey: `order-cancel-${orderId}` },
  );
  if (refund.status === 'failed' || refund.status === 'canceled') {
    throw new Error(`Stripe rechazó el reembolso (${refund.status}).`);
  }
  return { externalId: refund.id, status: refund.status ?? 'pending' };
}

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function paypalAccessToken() {
  const config = await paypalPaymentConfig();
  const clientId = required(config.clientId, 'PayPal Client ID');
  const clientSecret = required(config.clientSecret, 'PayPal Client Secret');
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  const data = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || 'No se pudo autenticar con PayPal.');
  }
  return data.access_token;
}

async function refundPayPal(captureId: string, orderId: string): Promise<RefundResult> {
  const token = await paypalAccessToken();
  const config = await paypalPaymentConfig();
  const assertion =
    config.splitEnabled && config.clientId && config.sellerMerchantId
      ? paypalAuthAssertion(config.clientId, config.sellerMerchantId)
      : undefined;
  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `cancel-${orderId.slice(0, 30)}`,
        Prefer: 'return=representation',
        ...(config.partnerAttributionId
          ? { 'PayPal-Partner-Attribution-Id': config.partnerAttributionId }
          : {}),
        ...(assertion ? { 'PayPal-Auth-Assertion': assertion } : {}),
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    },
  );
  const data = (await response.json()) as { id?: string; status?: string; message?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.message || `PayPal rechazó el reembolso (${response.status}).`);
  }
  return { externalId: data.id, status: data.status ?? 'PENDING' };
}

async function refundMercadoPago(paymentId: string, orderId: string): Promise<RefundResult> {
  const { accessToken } = await mercadoPagoPaymentConfig();
  const token = required(accessToken, 'Mercado Pago del comercio');
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `order-cancel-${orderId}`,
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    },
  );
  const data = (await response.json()) as {
    id?: string | number;
    status?: string;
    message?: string;
    error?: string;
  };
  if (!response.ok || data.id == null) {
    throw new Error(
      data.message || data.error || `Mercado Pago rechazó el reembolso (${response.status}).`,
    );
  }
  return { externalId: String(data.id), status: data.status ?? 'approved' };
}

export async function refundPaidOrder(
  provider: PaymentProvider,
  paymentExternalId: string,
  orderId: string,
): Promise<RefundResult> {
  if (provider === 'STRIPE') return refundStripe(paymentExternalId, orderId);
  if (provider === 'PAYPAL') return refundPayPal(paymentExternalId, orderId);
  return refundMercadoPago(paymentExternalId, orderId);
}
