import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, cacheLifeMock, cacheTagMock } = vi.hoisted(() => ({
  prismaMock: {
    product: { findMany: vi.fn() },
    productSku: { findMany: vi.fn() },
    productReview: { groupBy: vi.fn() },
  },
  cacheLifeMock: vi.fn(),
  cacheTagMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('next/cache', () => ({
  cacheLife: cacheLifeMock,
  cacheTag: cacheTagMock,
}));

import {
  getCachedCatalogReviewAggregates,
  getPublicCatalogProducts,
  PUBLIC_CATALOG_CACHE_TAG,
  PUBLIC_CATALOG_REVIEWS_CACHE_TAG,
} from './public-catalog';

describe('public catalog cache policy', () => {
  beforeEach(() => {
    prismaMock.product.findMany.mockReset();
    prismaMock.productSku.findMany.mockReset();
    prismaMock.productReview.groupBy.mockReset();
    cacheLifeMock.mockClear();
    cacheTagMock.mockClear();
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: 101,
        name: 'Jacket',
        description: 'Weatherproof jacket',
        price: 50000,
        category: 'jackets',
        isActive: true,
        variants: [
          {
            id: 'variant-1',
            colorName: 'Black',
            images: [{ id: 'image-1', url: '/jacket.webp' }],
            skus: [
              { id: 'sku-s', articleId: 1001, size: 'S' },
              { id: 'sku-m', articleId: 1002, size: 'M' },
            ],
          },
        ],
      },
      {
        id: 102,
        name: 'Pants',
        description: 'Cotton pants',
        price: 32000,
        category: 'pants',
        isActive: true,
        variants: [],
      },
    ]);
    prismaMock.productSku.findMany
      .mockResolvedValueOnce([
        { id: 'sku-s', stock: 3 },
        { id: 'sku-m', stock: 2 },
      ])
      .mockResolvedValueOnce([
        { id: 'sku-s', stock: 1 },
        { id: 'sku-m', stock: 0 },
      ]);
    prismaMock.productReview.groupBy.mockResolvedValue([]);
  });

  it('re-reads real inventory on every request and merges it into catalog data', async () => {
    const first = await getPublicCatalogProducts({ category: 'JACKETS' });
    const second = await getPublicCatalogProducts({ category: 'jackets' });

    expect(first).toHaveLength(1);
    expect(first[0].variants[0].skus.map((sku) => sku.stock)).toEqual([3, 2]);
    expect(second[0].variants[0].skus.map((sku) => sku.stock)).toEqual([1, 0]);
    // Vitest executes the function directly; Next.js applies the "use cache" directive at runtime.
    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.productSku.findMany).toHaveBeenCalledTimes(2);
  });

  it('does not query inventory for a product filter that matches nothing', async () => {
    const products = await getPublicCatalogProducts({ productId: 999 });

    expect(products).toEqual([]);
    expect(prismaMock.productSku.findMany).not.toHaveBeenCalled();
  });

  it('declares separate cache lifetimes and invalidation tags for metadata and review aggregates', async () => {
    await getPublicCatalogProducts();
    await getCachedCatalogReviewAggregates();

    expect(cacheLifeMock).toHaveBeenNthCalledWith(1, {
      stale: 300,
      revalidate: 300,
      expire: 3600,
    });
    expect(cacheLifeMock).toHaveBeenNthCalledWith(2, {
      stale: 60,
      revalidate: 60,
      expire: 3600,
    });
    expect(cacheTagMock).toHaveBeenNthCalledWith(1, PUBLIC_CATALOG_CACHE_TAG);
    expect(cacheTagMock).toHaveBeenNthCalledWith(2, PUBLIC_CATALOG_REVIEWS_CACHE_TAG);
  });
});
