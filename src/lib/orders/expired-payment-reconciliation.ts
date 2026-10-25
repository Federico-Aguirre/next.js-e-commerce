import 'server-only';
import Stripe from 'stripe';
import { Env } from '@/lib/Env';
import {
  mercadoPagoPaymentConfig,
  paypalAuthAssertion,
  paypalPaymentConfig,
  stripePaymentConfig,
} from '@/lib/payments/platform-config';

const MERCADO_PAGO_API = 'https://api.mercadopago.com';

type ExpiredOrder = {
  id: string;
  paymentProvider: string | null;
  paymentExternalId: string | null;
  createdAt: Date;
};

type PaymentDecision =
  | { action: 'PAID'; externalId: string }
  | { action: 'EXPIRE' }
  | { action: 'DEFER' };

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is JsonRecord => item !== null)
    : [];
}

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function isTerminalPaymentStatus(status: string): boolean {
  return new Set([
    'rejected',
    'cancelled',
    'canceled',
    'expired',
    'refunded',
    'charged_back',
    'voided',
  ]).has(status.toLowerCase());
}

function isUnresolvedPaymentStatus(status: string): boolean {
  return new Set([
    'pending',
    'in_process',
    'processing',
    'authorized',
    'in_mediation',
    'in_review',
    'created',
    'approved',
    'payer_action_required',
  ]).has(status.toLowerCase());
}

async function verifyMercadoPagoOrder(order: ExpiredOrder): Promise<PaymentDecision> {
  const { accessToken } = await mercadoPagoPaymentConfig();
  if (!accessToken) return { action: 'DEFER' };

  const paymentUrl = new URL('/v1/payments/search', MERCADO_PAGO_API);
  paymentUrl.searchParams.set('external_reference', order.id);

  const ordersUrl = new URL('/v1/orders', MERCADO_PAGO_API);
  ordersUrl.searchParams.set('external_reference', order.id);
  ordersUrl.searchParams.set('type', 'online');
  ordersUrl.searchParams.set(
    'begin_date',
    new Date(order.createdAt.getTime() - 5 * 60 * 1000).toISOString(),
  );
  ordersUrl.searchParams.set('end_date', new Date(Date.now() + 5 * 60 * 1000).toISOString());

  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  const [paymentsResponse, ordersResponse] = await Promise.all([
    fetch(paymentUrl, { headers, cache: 'no-store', signal: AbortSignal.timeout(8_000) }),
    fetch(ordersUrl, { headers, cache: 'no-store', signal: AbortSignal.timeout(8_000) }),
  ]);

  const paymentsBody = paymentsResponse.ok ? await paymentsResponse.json().catch(() => null) : null;
  const ordersBody = ordersResponse.ok ? await ordersResponse.json().catch(() => null) : null;
  const payments = asRecords(asRecord(paymentsBody)?.results).filter(
    (payment) => asText(payment.external_reference) === order.id,
  );
  const remoteOrders = asRecords(asRecord(ordersBody)?.data).filter(
    (remoteOrder) => asText(remoteOrder.external_reference) === order.id,
  );

  const approvedPayment = payments.find(
    (payment) =>
      asText(payment.status) === 'approved' && asText(payment.status_detail) === 'accredited',
  );
  if (approvedPayment) {
    const externalId = asText(approvedPayment.id);
    return externalId ? { action: 'PAID', externalId } : { action: 'DEFER' };
  }

  const approvedOrder = remoteOrders.find((remoteOrder) => {
    const transaction = asRecords(asRecord(remoteOrder.transactions)?.payments)[0];
    return (
      asText(remoteOrder.status) === 'processed' &&
      asText(remoteOrder.status_detail) === 'accredited' &&
      asText(transaction?.status) === 'processed' &&
      asText(transaction?.status_detail) === 'accredited'
    );
  });
  if (approvedOrder) {
    const externalId = asText(approvedOrder.id);
    return externalId ? { action: 'PAID', externalId } : { action: 'DEFER' };
  }

  const hasUnresolvedPayment = payments.some((payment) =>
    isUnresolvedPaymentStatus(asText(payment.status)),
  );
  const hasUnresolvedOrder = remoteOrders.some((remoteOrder) => {
    const orderStatus = asText(remoteOrder.status);
    const transaction = asRecords(asRecord(remoteOrder.transactions)?.payments)[0];
    const paymentStatus = asText(transaction?.status);
    return (
      !isTerminalPaymentStatus(orderStatus) ||
      (paymentStatus !== '' && !isTerminalPaymentStatus(paymentStatus))
    );
  });

  if (hasUnresolvedPayment || hasUnresolvedOrder) return { action: 'DEFER' };
  if (!paymentsResponse.ok || !ordersResponse.ok) return { action: 'DEFER' };

  return { action: 'EXPIRE' };
}

async function verifyStripeOrder(order: ExpiredOrder): Promise<PaymentDecision> {
  if (!order.paymentExternalId) return { action: 'EXPIRE' };

  const { secretKey } = await stripePaymentConfig();
  if (!secretKey) return { action: 'DEFER' };

  const stripe = new Stripe(secretKey, { timeout: 8_000 });
  let intent = await stripe.paymentIntents.retrieve(order.paymentExternalId);

  if (intent.status === 'succeeded') return { action: 'PAID', externalId: intent.id };
  if (intent.status === 'processing') return { action: 'DEFER' };
  if (intent.status === 'canceled') return { action: 'EXPIRE' };

  try {
    intent = await stripe.paymentIntents.cancel(intent.id);
    return intent.status === 'canceled'
      ? { action: 'EXPIRE' }
      : intent.status === 'succeeded'
        ? { action: 'PAID', externalId: intent.id }
        : { action: 'DEFER' };
  } catch {
    const reconciled = await stripe.paymentIntents.retrieve(order.paymentExternalId);
    if (reconciled.status === 'succeeded') {
      return { action: 'PAID', externalId: reconciled.id };
    }
    return reconciled.status === 'canceled' ? { action: 'EXPIRE' } : { action: 'DEFER' };
  }
}

async function verifyPayPalOrder(order: ExpiredOrder): Promise<PaymentDecision> {
  if (!order.paymentExternalId) return { action: 'EXPIRE' };

  const config = await paypalPaymentConfig();
  if (!config.clientId || !config.clientSecret) return { action: 'DEFER' };

  const apiBase =
    Env.PAYPAL_ENVIRONMENT === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const tokenResponse = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!tokenResponse.ok) return { action: 'DEFER' };

  const tokenBody = asRecord(await tokenResponse.json().catch(() => null));
  const accessToken = asText(tokenBody?.access_token);
  if (!accessToken) return { action: 'DEFER' };

  const assertion =
    config.splitEnabled && config.clientId && config.sellerMerchantId
      ? paypalAuthAssertion(config.clientId, config.sellerMerchantId)
      : undefined;
  const orderResponse = await fetch(
    `${apiBase}/v2/checkout/orders/${encodeURIComponent(order.paymentExternalId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(config.partnerAttributionId
          ? { 'PayPal-Partner-Attribution-Id': config.partnerAttributionId }
          : {}),
        ...(assertion ? { 'PayPal-Auth-Assertion': assertion } : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!orderResponse.ok) return { action: 'DEFER' };

  const remoteOrder = asRecord(await orderResponse.json().catch(() => null));
  const status = asText(remoteOrder?.status).toUpperCase();
  if (status === 'COMPLETED') {
    const purchaseUnit = asRecords(remoteOrder?.purchase_units)[0];
    const payments = asRecord(purchaseUnit?.payments);
    const capture = asRecords(payments?.captures)[0];
    const captureId = asText(capture?.id);
    return asText(capture?.status).toUpperCase() === 'COMPLETED' && captureId
      ? { action: 'PAID', externalId: captureId }
      : { action: 'DEFER' };
  }

  if (['CREATED', 'APPROVED', 'PAYER_ACTION_REQUIRED', 'VOIDED'].includes(status)) {
    return { action: 'EXPIRE' };
  }
  return { action: 'DEFER' };
}

export async function verifyExpiredPayment(order: ExpiredOrder): Promise<PaymentDecision> {
  switch (order.paymentProvider) {
    case 'MERCADOPAGO':
      return verifyMercadoPagoOrder(order);
    case 'STRIPE':
      return verifyStripeOrder(order);
    case 'PAYPAL':
      return verifyPayPalOrder(order);
    default:
      return order.paymentExternalId ? { action: 'DEFER' } : { action: 'EXPIRE' };
  }
}
