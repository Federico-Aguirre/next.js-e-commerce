import 'server-only';
import { restoreOrderStock } from '@/lib/checkout/inventory';
import { sendLowStockAlerts, sendPaidOrderAlert } from '@/lib/order-alerts';
import { verifyExpiredPayment } from '@/lib/orders/expired-payment-reconciliation';
import { sendOrderConfirmationEmail } from '@/lib/orders/order-confirmation-email';
import { prisma } from '@/lib/prisma';

const CHECKOUT_EXPIRATION_GRACE_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const STALE_PROCESSING_MS = 10 * 60 * 1000;

type ExpiredOrder = {
  id: string;
  status: string;
  paymentProvider: string | null;
  paymentExternalId: string | null;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
  items: Array<{ productId: string; size: string; quantity: number }>;
};

type CleanupCutoffs = {
  expirationCutoff: Date;
  retryCutoff: Date;
  staleProcessingCutoff: Date;
};

type CleanupOutcome = 'expired' | 'paid' | 'deferred' | 'error' | 'skipped';

async function processExpiredOrder(
  order: ExpiredOrder,
  cutoffs: CleanupCutoffs,
): Promise<CleanupOutcome> {
  const claim =
    order.status === 'PENDING'
      ? await prisma.order.updateMany({
          where: {
            id: order.id,
            status: 'PENDING',
            expiresAt: { lte: cutoffs.expirationCutoff },
            updatedAt: { lte: cutoffs.retryCutoff },
          },
          data: { status: 'EXPIRING' },
        })
      : order.status === 'PAYMENT_PROCESSING'
        ? await prisma.order.updateMany({
            where: {
              id: order.id,
              status: 'PAYMENT_PROCESSING',
              expiresAt: { lte: cutoffs.expirationCutoff },
              updatedAt: { lte: cutoffs.staleProcessingCutoff },
            },
            data: { status: 'EXPIRING' },
          })
        : order.status === 'CANCELLING'
          ? await prisma.order.updateMany({
              where: {
                id: order.id,
                status: 'CANCELLING',
                expiresAt: { lte: cutoffs.expirationCutoff },
                updatedAt: { lte: cutoffs.staleProcessingCutoff },
              },
              data: { status: 'EXPIRING' },
            })
          : await prisma.order.updateMany({
              where: {
                id: order.id,
                status: 'EXPIRING',
                updatedAt: { lte: cutoffs.staleProcessingCutoff },
              },
              data: { status: 'EXPIRING' },
            });

  if (claim.count !== 1) return 'skipped';

  try {
    const decision = await verifyExpiredPayment(order);

    if (decision.action === 'PAID') {
      const updated = await prisma.order.updateMany({
        where: { id: order.id, status: 'EXPIRING' },
        data: { status: 'PAID', paymentExternalId: decision.externalId },
      });
      if (updated.count !== 1) return 'skipped';

      await sendOrderConfirmationEmail(order.id);
      void sendPaidOrderAlert(order.id).catch(() => undefined);
      void sendLowStockAlerts().catch(() => undefined);
      return 'paid';
    }

    if (decision.action === 'DEFER') {
      await prisma.order.updateMany({
        where: { id: order.id, status: 'EXPIRING' },
        data: { status: 'PENDING' },
      });
      return 'deferred';
    }

    const restored = await prisma.$transaction(
      async (tx) => {
        const finalized = await tx.order.updateMany({
          where: { id: order.id, status: 'EXPIRING' },
          data: { status: 'EXPIRED' },
        });
        if (finalized.count !== 1) return false;
        await restoreOrderStock(tx, order.items);
        return true;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
    return restored ? 'expired' : 'skipped';
  } catch (error) {
    await prisma.order
      .updateMany({
        where: { id: order.id, status: 'EXPIRING' },
        data: { status: 'PENDING' },
      })
      .catch(() => undefined);
    console.error('Expired checkout reconciliation failed.', {
      orderId: order.id,
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return 'error';
  }
}

export async function expireStaleCheckoutOrders(
  options: {
    now?: Date;
    limit?: number;
    userId?: string;
  } = {},
) {
  const now = options.now ?? new Date();
  const limit = Math.min(50, Math.max(1, Math.trunc(options.limit ?? 25)));
  const expirationCutoff = new Date(now.getTime() - CHECKOUT_EXPIRATION_GRACE_MS);
  const retryCutoff = new Date(now.getTime() - RETRY_DELAY_MS);
  const staleProcessingCutoff = new Date(now.getTime() - STALE_PROCESSING_MS);

  const candidates = (await prisma.order.findMany({
    where: {
      ...(options.userId ? { userId: options.userId } : {}),
      OR: [
        {
          status: 'PENDING',
          expiresAt: { lte: expirationCutoff },
          updatedAt: { lte: retryCutoff },
        },
        {
          status: 'PAYMENT_PROCESSING',
          expiresAt: { lte: expirationCutoff },
          updatedAt: { lte: staleProcessingCutoff },
        },
        {
          status: 'CANCELLING',
          expiresAt: { lte: expirationCutoff },
          updatedAt: { lte: staleProcessingCutoff },
        },
        { status: 'EXPIRING', updatedAt: { lte: staleProcessingCutoff } },
      ],
    },
    orderBy: { expiresAt: 'asc' },
    take: limit,
    include: { items: true },
  })) as ExpiredOrder[];

  let expired = 0;
  let reconciledPaid = 0;
  let deferred = 0;
  let errors = 0;

  const outcomes: CleanupOutcome[] = [];
  const cutoffs = { expirationCutoff, retryCutoff, staleProcessingCutoff };
  for (let index = 0; index < candidates.length; index += 3) {
    const batch = candidates.slice(index, index + 3);
    outcomes.push(
      ...(await Promise.all(batch.map((order) => processExpiredOrder(order, cutoffs)))),
    );
  }

  for (const outcome of outcomes) {
    if (outcome === 'expired') expired += 1;
    else if (outcome === 'paid') reconciledPaid += 1;
    else if (outcome === 'deferred') deferred += 1;
    else if (outcome === 'error') errors += 1;
  }

  return { examined: candidates.length, expired, reconciledPaid, deferred, errors };
}
