import { getServerSession } from 'next-auth/next';
import { getLocale, getTranslations } from 'next-intl/server';
import { ProductReviews } from '@/components/ecommerce/ProductReviews';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { findDeliveredPurchaseForProduct } from '@/lib/reviews/delivered-purchase';

type ProductReviewsSectionProps = {
  productId: number;
  productPath: string;
  locale?: string;
  prefixLocaleInCallback?: boolean;
};

export async function ProductReviewsSection({
  productId,
  productPath,
  locale: localeOverride,
  prefixLocaleInCallback = false,
}: ProductReviewsSectionProps) {
  const locale = localeOverride ?? (await getLocale());
  const callbackPath =
    prefixLocaleInCallback && locale !== 'en' ? `/${locale}${productPath}` : productPath;
  const t = localeOverride
    ? await getTranslations({ locale, namespace: 'Storefront' })
    : await getTranslations('Storefront');
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const [ratingAggregate, reviewRows, existingReview, deliveredPurchase] = await Promise.all([
    prisma.productReview.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.productReview.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    userId
      ? prisma.productReview.findUnique({
          where: { productId_userId: { productId, userId } },
          select: { id: true },
        })
      : Promise.resolve(null),
    userId ? findDeliveredPurchaseForProduct(userId, productId) : Promise.resolve(null),
  ]);

  const reviews = reviewRows.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    authorName: review.user.name,
  }));

  return (
    <ProductReviews
      productId={productId}
      locale={locale}
      ratingAverage={ratingAggregate._avg.rating ?? 0}
      ratingCount={ratingAggregate._count._all}
      reviews={reviews}
      isSignedIn={Boolean(userId)}
      canReview={Boolean(userId && deliveredPurchase && !existingReview)}
      hasReviewed={Boolean(existingReview)}
      signInHref={`/sign-in?callbackUrl=${encodeURIComponent(callbackPath)}`}
      labels={{
        title: t('product.reviews.title'),
        noReviews: t('product.reviews.noReviews'),
        empty: t('product.reviews.empty'),
        opinion: t('product.reviews.opinion'),
        opinions: t('product.reviews.opinions'),
        verifiedBuyer: t('product.reviews.verifiedBuyer'),
        signInRequired: t('product.reviews.signInRequired'),
        deliveryRequired: t('product.reviews.deliveryRequired'),
        alreadyReviewed: t('product.reviews.alreadyReviewed'),
        ratingLabel: t('product.reviews.ratingLabel'),
        star: t('product.reviews.star'),
        commentLabel: t('product.reviews.commentLabel'),
        commentPlaceholder: t('product.reviews.commentPlaceholder'),
        submit: t('product.reviews.submit'),
        submitting: t('product.reviews.submitting'),
        submitted: t('product.reviews.submitted'),
        submitError: t('product.reviews.submitError'),
        ratingRequired: t('product.reviews.ratingRequired'),
        signIn: t('product.reviews.signIn'),
        invalidReview: t('product.reviews.invalidReview'),
      }}
    />
  );
}
