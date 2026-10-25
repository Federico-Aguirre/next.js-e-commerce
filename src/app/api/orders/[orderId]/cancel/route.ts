import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { refundPaidOrder, type PaymentProvider } from '@/lib/payments/refund-order';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

const REFUND_COMPLETE = new Set(['succeeded', 'completed', 'approved', 'refunded']);

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const authenticatedUser = await getAuthenticatedUser(request);
  const userId = authenticatedUser?.id;
  if (!userId) {
    return NextResponse.json(
      { error: 'UNAUTHENTICATED' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }

  const rateLimit = checkRateLimit('order-cancel:' + hashRateLimitIdentity(userId), {
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'Cache-Control': 'private, no-store, max-age=0',
        },
      },
    );
  }

  const { orderId } = await params;
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });

  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (order.fulfillmentStatus === 'CANCELLED' || order.status === 'REFUNDED') {
    return NextResponse.json({ success: true, alreadyCancelled: true });
  }
  if (order.status !== 'PAID') {
    return NextResponse.json({ error: 'NOT_PAID' }, { status: 409 });
  }
  if (
    order.fulfillmentStatus !== 'PENDING' ||
    order.shippingExternalId ||
    order.shippingStatus === 'CREATING'
  ) {
    return NextResponse.json({ error: 'TOO_LATE' }, { status: 409 });
  }

  let provider = order.paymentProvider as PaymentProvider | null;
  let paymentExternalId = order.paymentExternalId;

  if (!provider && /^\d+$/.test(order.id)) {
    provider = 'MERCADOPAGO';
    paymentExternalId = order.id;
  }

  if (!provider || !paymentExternalId) {
    return NextResponse.json({ error: 'REFUND_DATA_MISSING' }, { status: 409 });
  }

  const claim = await prisma.order.updateMany({
    where: {
      id: order.id,
      userId,
      status: 'PAID',
      fulfillmentStatus: 'PENDING',
      shippingExternalId: null,
      OR: [{ shippingStatus: null }, { shippingStatus: { not: 'CREATING' } }],
    },
    data: { fulfillmentStatus: 'CANCELLING' },
  });

  if (claim.count !== 1) {
    return NextResponse.json({ error: 'TOO_LATE' }, { status: 409 });
  }

  try {
    const refund = await refundPaidOrder(provider, paymentExternalId, order.id);
    const normalizedRefundStatus = refund.status.toLowerCase();
    const paymentStatus = REFUND_COMPLETE.has(normalizedRefundStatus)
      ? 'REFUNDED'
      : 'REFUND_PENDING';

    await prisma.$transaction(async (tx) => {
      const finalized = await tx.order.updateMany({
        where: {
          id: order.id,
          userId,
          fulfillmentStatus: 'CANCELLING',
          shippingExternalId: null,
        },
        data: {
          status: paymentStatus,
          fulfillmentStatus: 'CANCELLED',
          refundExternalId: refund.externalId,
          refundStatus: refund.status,
          cancelledAt: new Date(),
          refundedAt: paymentStatus === 'REFUNDED' ? new Date() : null,
        },
      });

      if (finalized.count !== 1) throw new Error('El pedido cambió mientras se cancelaba.');

      for (const item of order.items) {
        const articleId = Number(item.productId);
        if (!Number.isInteger(articleId) || articleId <= 0) continue;
        await tx.productSku.updateMany({
          where: { articleId, size: item.size },
          data: { stock: { increment: item.quantity } },
        });
      }
    });

    return NextResponse.json({ success: true, refundStatus: refund.status, paymentStatus });
  } catch (error) {
    await prisma.order.updateMany({
      where: { id: order.id, userId, fulfillmentStatus: 'CANCELLING' },
      data: { fulfillmentStatus: 'PENDING' },
    });
    console.error(
      'Order cancellation refund failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return NextResponse.json(
      {
        error: 'REFUND_FAILED',
        message:
          'No se pudo confirmar el reembolso. El pedido requiere verificación antes de volver a intentarlo.',
      },
      { status: 502 },
    );
  }
}
