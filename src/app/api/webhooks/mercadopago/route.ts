import { NextResponse } from 'next/server';
import { restoreOrderStock } from '@/lib/checkout/inventory';
import { Env } from '@/lib/Env';
import { sendLowStockAlerts, sendPaidOrderAlert, sendPaymentReviewAlert } from '@/lib/order-alerts';
import { sendOrderConfirmationEmail } from '@/lib/orders/order-confirmation-email';
import {
  mercadoPagoPaymentConfig,
  refreshPlatformSubscriptionPlan,
} from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';
import { verifyMercadoPagoSignature } from '@/lib/security/mercadopago-webhook-signature';

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;
const SUPPORTED_TOPICS = new Set(['order', 'payment']);

type Topic = 'order' | 'payment';
type ProviderPayment = {
  id?: string | number;
  status?: string;
  status_detail?: string;
  amount?: string | number;
  paid_amount?: string | number;
};
type ProviderResource = {
  id?: string | number;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  currency_id?: string;
  total_amount?: string | number;
  total_paid_amount?: string | number;
  transaction_amount?: string | number;
  transactions?: { payments?: ProviderPayment[] };
};
type WebhookBody = {
  type?: unknown;
  action?: unknown;
  data?: { id?: unknown };
};

type ReviewReason =
  | 'amount_or_currency_mismatch'
  | 'reservation_expired'
  | 'previously_failed'
  | 'partial_refund'
  | 'chargeback';

function privateNoStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return NextResponse.json(body, { ...init, headers });
}

function asMoney(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : null;
}

function moneyMatches(value: unknown, expected: number): boolean {
  const parsed = asMoney(value);
  return parsed !== null && parsed === Number(expected.toFixed(2));
}

function sameCurrency(value: unknown, expected: string): boolean {
  return typeof value === 'string' && value.trim().toUpperCase() === expected.trim().toUpperCase();
}

async function getProviderResource(accessToken: string, topic: Topic, resourceId: string) {
  const path =
    topic === 'order'
      ? '/v1/orders/' + encodeURIComponent(resourceId)
      : '/v1/payments/' + encodeURIComponent(resourceId);

  const response = await fetch('https://api.mercadopago.com' + path, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  let data: ProviderResource | null = null;
  try {
    data = (await response.json()) as ProviderResource;
  } catch {
    data = null;
  }

  return { response, data };
}

function hasSuccessfulOrderPayment(resource: ProviderResource, expectedAmount: number): boolean {
  const payments = resource.transactions?.payments;
  if (!Array.isArray(payments) || payments.length === 0) return false;

  return payments.some(
    (payment) =>
      payment.status === 'processed' &&
      payment.status_detail === 'accredited' &&
      moneyMatches(payment.paid_amount ?? payment.amount, expectedAmount),
  );
}

function isSuccessfulResource(topic: Topic, resource: ProviderResource): boolean {
  if (topic === 'order') {
    return resource.status === 'processed' && resource.status_detail === 'accredited';
  }
  return resource.status === 'approved' && resource.status_detail === 'accredited';
}

function isTerminalFailure(topic: Topic, resource: ProviderResource): boolean {
  if (topic === 'order') {
    return resource.status === 'failed' || resource.status === 'canceled';
  }
  return ['rejected', 'cancelled', 'canceled', 'expired'].includes(
    String(resource.status ?? '').toLowerCase(),
  );
}

function isPartialRefund(topic: Topic, resource: ProviderResource): boolean {
  return topic === 'order'
    ? resource.status === 'processed' && resource.status_detail === 'partially_refunded'
    : resource.status === 'approved' && resource.status_detail === 'partially_refunded';
}

function isFullyRefunded(topic: Topic, resource: ProviderResource): boolean {
  return topic === 'order'
    ? resource.status === 'refunded' && resource.status_detail === 'refunded'
    : resource.status === 'refunded';
}

function isChargedBack(resource: ProviderResource): boolean {
  return resource.status === 'charged_back';
}

function resourceAmountsMatch(
  topic: Topic,
  resource: ProviderResource,
  expectedAmount: number,
  expectedCurrency: string,
): boolean {
  if (!sameCurrency(resource.currency_id, expectedCurrency)) return false;

  if (topic === 'payment') {
    return moneyMatches(resource.transaction_amount, expectedAmount);
  }

  return (
    moneyMatches(resource.total_amount, expectedAmount) &&
    moneyMatches(resource.total_paid_amount, expectedAmount) &&
    hasSuccessfulOrderPayment(resource, expectedAmount)
  );
}

async function updateOrderState(
  order: {
    id: string;
    status: string;
    paymentExternalId: string | null;
    paymentProvider: string | null;
  },
  providerResourceId: string,
  data: Record<string, unknown>,
) {
  // Re-check the current ID in the database as well as in the snapshot we read.
  // A different payment ID must never overwrite an existing payment association.
  if (
    order.paymentExternalId &&
    order.paymentExternalId.toLowerCase() !== providerResourceId.toLowerCase()
  ) {
    return { count: 0 };
  }

  return prisma.order.updateMany({
    where: {
      id: order.id,
      status: order.status,
      paymentProvider: 'MERCADOPAGO',
      paymentExternalId: order.paymentExternalId,
    },
    data,
  });
}

async function flagForManualReview(
  order: {
    id: string;
    status: string;
    paymentExternalId: string | null;
    paymentProvider: string | null;
    orderNumber: number;
    refundStatus?: string | null;
  },
  providerResourceId: string,
  reason: ReviewReason,
) {
  const alreadyReviewing = order.status === 'PAYMENT_REVIEW';
  const update = await updateOrderState(order, providerResourceId, {
    status: 'PAYMENT_REVIEW',
    paymentExternalId: providerResourceId,
    ...(reason === 'partial_refund' ? { refundStatus: 'PARTIALLY_REFUNDED' } : {}),
    ...(reason === 'chargeback' ? { refundStatus: 'CHARGED_BACK' } : {}),
  });

  // Repeated delivery of the same Webhook must not produce duplicate admin alerts.
  if (update.count === 1 && !alreadyReviewing) {
    await sendPaymentReviewAlert(order.id, reason);
    return true;
  }
  return update.count === 1;
}

export async function POST(request: Request) {
  const secret = Env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return privateNoStoreJson(
      { error: 'La verificación de firma del webhook no está configurada.' },
      { status: 503 },
    );
  }

  // The signed data.id is validated before parsing or querying any provider resource.
  if (!verifyMercadoPagoSignature(request, secret)) {
    return privateNoStoreJson({ error: 'Firma de webhook inválida.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const topicValue = (url.searchParams.get('type') ?? '').trim().toLowerCase();
  if (!SUPPORTED_TOPICS.has(topicValue)) {
    return privateNoStoreJson({ received: true, ignored: true });
  }
  const topic = topicValue as Topic;
  const resourceId = (url.searchParams.get('data.id') ?? '').trim();

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return privateNoStoreJson({ error: 'Notificación demasiado grande.' }, { status: 413 });
  }

  let rawBody: string;
  let event: WebhookBody;
  try {
    rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
      return privateNoStoreJson({ error: 'Notificación demasiado grande.' }, { status: 413 });
    }
    event = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return privateNoStoreJson(
      { error: 'El cuerpo de la notificación no es JSON válido.' },
      { status: 400 },
    );
  }

  // type and body are not part of MP's HMAC manifest. They are only used to
  // select an API endpoint; the provider resource and all payment data are fetched below.
  if (
    typeof event.type !== 'string' ||
    event.type.toLowerCase() !== topic ||
    !event.data ||
    String(event.data.id ?? '').toLowerCase() !== resourceId.toLowerCase()
  ) {
    return privateNoStoreJson({ received: true, ignored: true });
  }

  try {
    const { accessToken } = await mercadoPagoPaymentConfig();
    if (!accessToken) {
      return privateNoStoreJson(
        { error: 'Mercado Pago no está configurado para consultar el pago.' },
        { status: 503 },
      );
    }

    const { response: providerResponse, data: resource } = await getProviderResource(
      accessToken,
      topic,
      resourceId,
    );

    if (!providerResponse.ok) {
      // An unknown Data ID (common while testing the dashboard simulator) is not retryable.
      // Authentication failures are configuration errors and must not be silently acknowledged.
      if (
        providerResponse.status !== 429 &&
        providerResponse.status !== 401 &&
        providerResponse.status !== 403 &&
        providerResponse.status !== 404 &&
        providerResponse.status < 500
      ) {
        return privateNoStoreJson({ received: true, ignored: true });
      }
      if (providerResponse.status === 404) {
        return privateNoStoreJson({ received: true, ignored: true });
      }
      console.error(
        '[mercadopago-webhook] provider API temporarily unavailable or credentials rejected.',
        {
          status: providerResponse.status,
          topic,
        },
      );
      return privateNoStoreJson(
        { error: 'No se pudo consultar el recurso en Mercado Pago.' },
        { status: 503 },
      );
    }

    if (
      !resource ||
      String(resource.id ?? '').toLowerCase() !== resourceId.toLowerCase() ||
      typeof resource.external_reference !== 'string' ||
      !resource.external_reference.trim()
    ) {
      return privateNoStoreJson({ received: true, ignored: true });
    }

    const order = await prisma.order.findUnique({
      where: { id: resource.external_reference },
      include: { items: true },
    });

    if (!order || order.paymentProvider !== 'MERCADOPAGO') {
      return privateNoStoreJson({ received: true, ignored: true });
    }

    // Never let an event for a different provider resource overwrite an order
    // that is already tied to another payment/order ID.
    if (
      order.paymentExternalId &&
      order.paymentExternalId.toLowerCase() !== resourceId.toLowerCase()
    ) {
      console.warn('[mercadopago-webhook] provider resource does not match the order payment ID.', {
        orderId: order.id,
        topic,
      });
      return privateNoStoreJson({ received: true, ignored: true });
    }

    const successful = isSuccessfulResource(topic, resource);
    const fullyRefunded = isFullyRefunded(topic, resource);
    const partialRefund = isPartialRefund(topic, resource);
    const chargedBack = isChargedBack(resource);
    const terminalFailure = isTerminalFailure(topic, resource);
    const currencyAndAmountMatch = resourceAmountsMatch(
      topic,
      resource,
      Number(order.paymentTotal ?? Number.NaN),
      order.paymentCurrency,
    );

    if (fullyRefunded) {
      if (
        !sameCurrency(resource.currency_id, order.paymentCurrency) ||
        !moneyMatches(
          topic === 'order' ? resource.total_amount : resource.transaction_amount,
          Number(order.paymentTotal ?? Number.NaN),
        )
      ) {
        await flagForManualReview(order, resourceId, 'amount_or_currency_mismatch');
        return privateNoStoreJson({ received: true, reconciled: false, status: 'PAYMENT_REVIEW' });
      }

      if (order.status === 'REFUNDED') {
        return privateNoStoreJson({
          received: true,
          reconciled: true,
          status: 'REFUNDED',
          alreadyConfirmed: true,
        });
      }

      const refunded = await updateOrderState(order, resourceId, {
        status: 'REFUNDED',
        paymentExternalId: resourceId,
        refundStatus: 'REFUNDED',
        refundedAt: new Date(),
      });
      return privateNoStoreJson({
        received: true,
        reconciled: refunded.count === 1,
        status: refunded.count === 1 ? 'REFUNDED' : 'unchanged',
      });
    }

    if (partialRefund || chargedBack) {
      const originalAmount =
        topic === 'order' ? resource.total_amount : resource.transaction_amount;
      const refundResourceMatches =
        sameCurrency(resource.currency_id, order.paymentCurrency) &&
        moneyMatches(originalAmount, Number(order.paymentTotal ?? Number.NaN));
      const reason: ReviewReason = !refundResourceMatches
        ? 'amount_or_currency_mismatch'
        : partialRefund
          ? 'partial_refund'
          : 'chargeback';
      const changed = await flagForManualReview(order, resourceId, reason);
      return privateNoStoreJson({
        received: true,
        reconciled: changed,
        status: 'PAYMENT_REVIEW',
      });
    }

    if (successful && !currencyAndAmountMatch) {
      await flagForManualReview(order, resourceId, 'amount_or_currency_mismatch');
      return privateNoStoreJson({ received: true, reconciled: false, status: 'PAYMENT_REVIEW' });
    }

    if (terminalFailure) {
      if (!['PENDING', 'PAYMENT_PROCESSING'].includes(order.status)) {
        return privateNoStoreJson({ received: true, ignored: true });
      }

      const failedCount = await prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
            status: order.status,
            paymentProvider: 'MERCADOPAGO',
            paymentExternalId: order.paymentExternalId,
          },
          data: {
            status: 'PAYMENT_FAILED',
            paymentExternalId: resourceId,
          },
        });
        if (updated.count === 1) {
          await restoreOrderStock(tx, order.items);
        }
        return updated.count;
      });

      return privateNoStoreJson({
        received: true,
        reconciled: failedCount === 1,
        status: failedCount === 1 ? 'PAYMENT_FAILED' : 'unchanged',
      });
    }

    if (!successful || !currencyAndAmountMatch) {
      return privateNoStoreJson({ received: true, ignored: true });
    }

    if (order.status === 'PAID') {
      // The state is idempotent; this call can safely retry a failed confirmation email.
      await sendOrderConfirmationEmail(order.id);
      return privateNoStoreJson({
        received: true,
        reconciled: true,
        orderId: order.id,
        status: 'PAID',
        alreadyConfirmed: true,
      });
    }

    if (!['PENDING', 'PAYMENT_PROCESSING'].includes(order.status)) {
      if (['PAYMENT_FAILED', 'FAILED', 'EXPIRED'].includes(order.status)) {
        await flagForManualReview(order, resourceId, 'previously_failed');
        return privateNoStoreJson({ received: true, reconciled: false, status: 'PAYMENT_REVIEW' });
      }
      return privateNoStoreJson({ received: true, ignored: true });
    }

    if (order.paymentTotal === null || order.expiresAt.getTime() <= Date.now()) {
      await flagForManualReview(order, resourceId, 'reservation_expired');
      return privateNoStoreJson({ received: true, reconciled: false, status: 'PAYMENT_REVIEW' });
    }

    const updated = await updateOrderState(order, resourceId, {
      status: 'PAID',
      paymentExternalId: resourceId,
    });

    if (updated.count !== 1) {
      const current = await prisma.order.findUnique({
        where: { id: order.id },
        select: { status: true, paymentExternalId: true },
      });

      if (
        current?.status === 'PAID' &&
        current.paymentExternalId?.toLowerCase() === resourceId.toLowerCase()
      ) {
        await sendOrderConfirmationEmail(order.id);
        return privateNoStoreJson({
          received: true,
          reconciled: true,
          orderId: order.id,
          status: 'PAID',
          alreadyConfirmed: true,
        });
      }

      return privateNoStoreJson({ received: true, reconciled: false, status: 'unchanged' });
    }

    await refreshPlatformSubscriptionPlan();
    await Promise.allSettled([
      sendOrderConfirmationEmail(order.id),
      sendPaidOrderAlert(order.id),
      sendLowStockAlerts(),
    ]);

    return privateNoStoreJson({
      received: true,
      reconciled: true,
      orderId: order.id,
      status: 'PAID',
    });
  } catch (error) {
    console.error('[mercadopago-webhook] reconciliation failed.', {
      error: error instanceof Error ? error.name : 'UnknownError',
      topic,
    });
    return privateNoStoreJson({ error: 'No se pudo conciliar la notificación.' }, { status: 503 });
  }
}
