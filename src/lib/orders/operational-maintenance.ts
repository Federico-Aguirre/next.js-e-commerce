import 'server-only';
import { sendOrderConfirmationEmail } from '@/lib/orders/order-confirmation-email';
import { sendOrderFulfillmentEmail } from '@/lib/orders/order-fulfillment-email';
import { prisma } from '@/lib/prisma';
import { refreshOrderShipping } from '@/lib/shipping/order-shipping';

const RETRY_DELAY_MS = 5 * 60 * 1000;
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const SHIPMENT_REFRESH_INTERVAL_MS = 20 * 60 * 1000;
const MAX_EMAIL_ATTEMPTS = 8;

type OrderEmailRetry = { orderId: string; type: string };
type EmailRetryOutcome = 'SENT' | 'FAILED' | 'SKIPPED';

async function retryOrderEmailNotification(
  notification: OrderEmailRetry,
): Promise<EmailRetryOutcome> {
  try {
    if (notification.type === 'PURCHASE_CONFIRMATION') {
      await sendOrderConfirmationEmail(notification.orderId);
    } else if (notification.type === 'FULFILLMENT_PREPARING') {
      await sendOrderFulfillmentEmail(notification.orderId, 'PREPARING');
    } else if (notification.type === 'FULFILLMENT_IN_TRANSIT') {
      await sendOrderFulfillmentEmail(notification.orderId, 'IN_TRANSIT');
    } else if (notification.type.startsWith('DELIVERY_ESTIMATE_UPDATED_')) {
      const eventVersion = notification.type.slice('DELIVERY_ESTIMATE_UPDATED_'.length);
      if (!eventVersion) return 'SKIPPED';
      await sendOrderFulfillmentEmail(notification.orderId, 'DELIVERY_ESTIMATE_UPDATED', {
        eventVersion,
      });
    } else {
      return 'SKIPPED';
    }

    const current = await prisma.orderEmailNotification.findUnique({
      where: {
        orderId_type: { orderId: notification.orderId, type: notification.type },
      },
      select: { status: true },
    });
    return current?.status === 'SENT' ? 'SENT' : 'FAILED';
  } catch (error) {
    console.error('Order email retry failed.', {
      orderId: notification.orderId,
      type: notification.type,
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return 'FAILED';
  }
}

export async function retryOrderEmails(options: { now?: Date; limit?: number } = {}) {
  const now = options.now ?? new Date();
  const limit = Math.min(50, Math.max(1, Math.trunc(options.limit ?? 25)));
  const retryCutoff = new Date(now.getTime() - RETRY_DELAY_MS);
  const staleSendingCutoff = new Date(now.getTime() - STALE_PROCESSING_MS);

  const notifications = await prisma.orderEmailNotification.findMany({
    where: {
      attempts: { lt: MAX_EMAIL_ATTEMPTS },
      order: { status: 'PAID' },
      OR: [
        { status: { in: ['PENDING', 'FAILED'] }, updatedAt: { lte: retryCutoff } },
        { status: 'SENDING', updatedAt: { lte: staleSendingCutoff } },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: { orderId: true, type: true },
  });

  let attempted = 0;
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < notifications.length; index += 3) {
    const batch = notifications.slice(index, index + 3);
    const outcomes = await Promise.all(batch.map(retryOrderEmailNotification));
    for (const outcome of outcomes) {
      if (outcome === 'SKIPPED') continue;
      attempted += 1;
      if (outcome === 'SENT') sent += 1;
      else failed += 1;
    }
  }

  return { examined: notifications.length, attempted, sent, failed };
}

export async function monitorStaleShipmentCreations(options: { now?: Date; limit?: number } = {}) {
  const now = options.now ?? new Date();
  const limit = Math.min(50, Math.max(1, Math.trunc(options.limit ?? 20)));
  const staleCutoff = new Date(now.getTime() - STALE_PROCESSING_MS);

  const orders = await prisma.order.findMany({
    where: {
      status: 'PAID',
      shippingStatus: 'CREATING',
      shippingExternalId: null,
      updatedAt: { lte: staleCutoff },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: { id: true, shippingError: true },
  });

  let flagged = 0;
  let failed = 0;
  for (const order of orders) {
    if (order.shippingError) continue;

    try {
      const updated = await prisma.order.updateMany({
        where: {
          id: order.id,
          status: 'PAID',
          shippingStatus: 'CREATING',
          shippingExternalId: null,
          shippingError: null,
          updatedAt: { lte: staleCutoff },
        },
        data: {
          shippingError:
            'La creación del envío lleva más de 10 minutos sin resolverse. Revisá el proveedor y confirmá si la etiqueta existe antes de reintentar.',
        },
      });
      if (updated.count === 1) flagged += 1;
    } catch {
      failed += 1;
    }
  }

  return { examined: orders.length, flagged, failed };
}

export async function refreshInTransitShipments(options: { now?: Date; limit?: number } = {}) {
  const now = options.now ?? new Date();
  const limit = Math.min(20, Math.max(1, Math.trunc(options.limit ?? 10)));
  const refreshBefore = new Date(now.getTime() - SHIPMENT_REFRESH_INTERVAL_MS);

  const orders = await prisma.order.findMany({
    where: {
      status: 'PAID',
      fulfillmentStatus: 'SHIPPED',
      shippingProvider: { in: ['ZIPNOVA', 'SHIPPO'] },
      shippingExternalId: { not: null },
      updatedAt: { lte: refreshBefore },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: { id: true },
  });

  let refreshed = 0;
  let failed = 0;
  for (let index = 0; index < orders.length; index += 3) {
    const batch = orders.slice(index, index + 3);
    const results = await Promise.all(batch.map((order) => refreshOrderShipping(order.id)));
    for (const result of results) {
      if (result.success) refreshed += 1;
      else failed += 1;
    }
  }

  return { examined: orders.length, refreshed, failed };
}
