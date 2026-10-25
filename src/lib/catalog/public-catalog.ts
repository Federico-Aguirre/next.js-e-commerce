import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { PUBLIC_CATALOG_CACHE_TAG, PUBLIC_CATALOG_REVIEWS_CACHE_TAG } from './cache-tags';

export { PUBLIC_CATALOG_CACHE_TAG, PUBLIC_CATALOG_REVIEWS_CACHE_TAG } from './cache-tags';
const PUBLIC_CATALOG_CACHE_SECONDS = 300;
const PUBLIC_CATALOG_REVIEWS_CACHE_SECONDS = 60;

async function getCachedProductMetadata() {
  'use cache';

  cacheLife({
    stale: PUBLIC_CATALOG_CACHE_SECONDS,
    revalidate: PUBLIC_CATALOG_CACHE_SECONDS,
    expire: PUBLIC_CATALOG_CACHE_SECONDS * 12,
  });
  cacheTag(PUBLIC_CATALOG_CACHE_TAG);

  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      category: true,
      isActive: true,
      variants: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          colorName: true,
          images: { select: { id: true, url: true } },
          skus: {
            orderBy: { articleId: 'asc' },
            select: { id: true, articleId: true, size: true },
          },
        },
      },
    },
  });
}

export async function getCachedCatalogReviewAggregates() {
  'use cache';

  cacheLife({
    stale: PUBLIC_CATALOG_REVIEWS_CACHE_SECONDS,
    revalidate: PUBLIC_CATALOG_REVIEWS_CACHE_SECONDS,
    expire: PUBLIC_CATALOG_REVIEWS_CACHE_SECONDS * 60,
  });
  cacheTag(PUBLIC_CATALOG_REVIEWS_CACHE_TAG);

  return prisma.productReview.groupBy({
    by: ['productId'],
    _avg: { rating: true },
  });
}

type CatalogMetadata = Awaited<ReturnType<typeof getCachedProductMetadata>>[number];

export type PublicCatalogProduct = Omit<CatalogMetadata, 'variants'> & {
  variants: Array<
    Omit<CatalogMetadata['variants'][number], 'skus'> & {
      skus: Array<CatalogMetadata['variants'][number]['skus'][number] & { stock: number }>;
    }
  >;
};

export type PublicCatalogOptions = {
  category?: string;
  productId?: number;
  productIds?: readonly number[];
};

/**
 * Cache only public product metadata. Inventory quantities are deliberately
 * fetched from PostgreSQL on every call so checkouts and stock changes aren't
 * hidden behind a stale product cache.
 */
export async function getPublicCatalogProducts(
  options: PublicCatalogOptions = {},
): Promise<PublicCatalogProduct[]> {
  let products = await getCachedProductMetadata();

  if (typeof options.productId === 'number') {
    products = products.filter((product) => product.id === options.productId);
  }

  if (options.productIds) {
    const includedIds = new Set(options.productIds);
    products = products.filter((product) => includedIds.has(product.id));
  }

  if (options.category?.trim()) {
    const category = options.category.trim().toLocaleLowerCase('en-US');
    products = products.filter(
      (product) => product.category.toLocaleLowerCase('en-US') === category,
    );
  }

  if (products.length === 0) return [];

  const skuIds = products.flatMap((product) =>
    product.variants.flatMap((variant) => variant.skus.map((sku) => sku.id)),
  );

  if (skuIds.length === 0) {
    return products.map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        skus: variant.skus.map((sku) => ({ ...sku, stock: 0 })),
      })),
    }));
  }

  const liveSkuStock = await prisma.productSku.findMany({
    where: { id: { in: skuIds } },
    select: { id: true, stock: true },
  });
  const stockBySkuId = new Map(liveSkuStock.map((sku) => [sku.id, sku.stock]));

  return products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      skus: variant.skus.map((sku) => ({
        ...sku,
        stock: stockBySkuId.get(sku.id) ?? 0,
      })),
    })),
  }));
}

export async function getPublicCatalogProduct(productId: number) {
  const [product] = await getPublicCatalogProducts({ productId });
  return product ?? null;
}
