import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { PUBLIC_CATALOG_REVIEWS_CACHE_TAG } from '@/lib/catalog/cache-tags';
import { prisma } from '@/lib/prisma';
import { findDeliveredPurchaseForProduct } from '@/lib/reviews/delivered-purchase';
import { productReviewInputSchema } from '@/lib/reviews/review-schema';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

function privateNoStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return NextResponse.json(body, { ...init, headers });
}

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const authenticatedUser = await getAuthenticatedUser(request);
  const userId = authenticatedUser?.id;

  if (!userId) {
    return privateNoStoreJson({ errorCode: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const rateLimit = checkRateLimit('product-review:' + hashRateLimitIdentity(userId), {
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed) {
    return privateNoStoreJson(
      { errorCode: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { productId: productIdParam } = await context.params;
  const productId = Number(productIdParam);

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return privateNoStoreJson({ errorCode: 'PRODUCT_NOT_FOUND' }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = productReviewInputSchema.safeParse(body);

  if (!parsed.success) {
    return privateNoStoreJson({ errorCode: 'INVALID_REVIEW' }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true },
  });

  if (!product?.isActive) {
    return privateNoStoreJson({ errorCode: 'PRODUCT_NOT_FOUND' }, { status: 404 });
  }

  const existingReview = await prisma.productReview.findUnique({
    where: { productId_userId: { productId, userId } },
    select: { id: true },
  });

  if (existingReview) {
    return privateNoStoreJson({ errorCode: 'ALREADY_REVIEWED' }, { status: 409 });
  }

  const deliveredOrder = await findDeliveredPurchaseForProduct(userId, productId);

  if (!deliveredOrder) {
    return privateNoStoreJson({ errorCode: 'DELIVERY_REQUIRED' }, { status: 403 });
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

    revalidateTag(PUBLIC_CATALOG_REVIEWS_CACHE_TAG, 'max');
    return privateNoStoreJson(
      { review },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return privateNoStoreJson({ errorCode: 'ALREADY_REVIEWED' }, { status: 409 });
    }

    console.error(
      'Failed to create product review:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return privateNoStoreJson({ errorCode: 'SERVER_ERROR' }, { status: 500 });
  }
}
