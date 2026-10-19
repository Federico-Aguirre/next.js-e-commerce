import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * Returns a paid order that has been marked as delivered and contains one of
 * this product's real SKU article IDs. OrderItem.productId stores that SKU ID.
 */
export async function findDeliveredPurchaseForProduct(userId: string, productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      isActive: true,
      variants: {
        select: {
          skus: { select: { articleId: true } },
        },
      },
    },
  });

  if (!product?.isActive) {
    return null;
  }

  const articleIds = product.variants.flatMap((variant) =>
    variant.skus.map((sku) => String(sku.articleId)),
  );

  if (articleIds.length === 0) {
    return null;
  }

  return prisma.order.findFirst({
    where: {
      userId,
      status: 'PAID',
      fulfillmentStatus: 'DELIVERED',
      deliveredAt: { not: null },
      items: {
        some: {
          productId: { in: articleIds },
        },
      },
    },
    orderBy: { deliveredAt: 'desc' },
    select: { id: true, deliveredAt: true },
  });
}
