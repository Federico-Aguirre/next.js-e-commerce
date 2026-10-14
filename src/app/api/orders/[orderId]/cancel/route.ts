import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { refundPaidOrder, type PaymentProvider } from '@/lib/payments/refund-order';
import { prisma } from '@/lib/prisma';

const REFUND_COMPLETE = new Set(['succeeded', 'completed', 'approved', 'refunded']);

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

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
  if (order.fulfillmentStatus !== 'PENDING' || order.shippingExternalId) {
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
    console.error('Order cancellation refund failed:', error);
    return NextResponse.json(
      {
        error: 'REFUND_FAILED',
        message: error instanceof Error ? error.message : 'No se pudo reembolsar el pago.',
      },
      { status: 502 },
    );
  }
}
