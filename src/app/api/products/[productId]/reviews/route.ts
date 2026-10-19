import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { findDeliveredPurchaseForProduct } from '@/lib/reviews/delivered-purchase';
import { productReviewInputSchema } from '@/lib/reviews/review-schema';

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ errorCode: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { productId: productIdParam } = await context.params;
  const productId = Number(productIdParam);

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return NextResponse.json({ errorCode: 'PRODUCT_NOT_FOUND' }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = productReviewInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ errorCode: 'INVALID_REVIEW' }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true },
  });

  if (!product?.isActive) {
    return NextResponse.json({ errorCode: 'PRODUCT_NOT_FOUND' }, { status: 404 });
  }

  const existingReview = await prisma.productReview.findUnique({
    where: { productId_userId: { productId, userId } },
    select: { id: true },
  });

  if (existingReview) {
    return NextResponse.json({ errorCode: 'ALREADY_REVIEWED' }, { status: 409 });
  }

  const deliveredOrder = await findDeliveredPurchaseForProduct(userId, productId);

  if (!deliveredOrder) {
    return NextResponse.json({ errorCode: 'DELIVERY_REQUIRED' }, { status: 403 });
  }

  try {
    const review = await prisma.productReview.create({
      data: {
        productId,
        userId,
        orderId: deliveredOrder.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      },
      select: { id: true, rating: true, comment: true, createdAt: true },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ errorCode: 'ALREADY_REVIEWED' }, { status: 409 });
    }

    console.error('Failed to create product review:', error);
    return NextResponse.json({ errorCode: 'SERVER_ERROR' }, { status: 500 });
  }
}
