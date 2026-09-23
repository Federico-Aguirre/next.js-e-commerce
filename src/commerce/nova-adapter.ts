import type { Product as NovaProduct } from '@/types/product';

import type {
  CatalogCategory,
  CatalogProduct,
  CatalogVariant,
} from './catalog-domain';

export function mapNovaProductToCatalog(product: NovaProduct): CatalogProduct {
  const slug = product.name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const categorySlug = product.category.toLowerCase().replace(/\s+/g, '-');
  const category: CatalogCategory = {
    id: categorySlug,
    slug: categorySlug,
    name: product.category,
  };

  const allMedia = product.variants.flatMap((variant, vIdx) =>
    variant.images.map((img, imgIdx) => ({
      id: img.id,
      kind: 'image' as const,
      url: img.url,
      alt: `${product.name} - ${variant.colorName}`,
      position: vIdx * 10 + imgIdx,
    })),
  );

  const variants: CatalogVariant[] = product.variants.map((v, idx) => {
    const totalStock = v.skus.reduce((sum, sku) => sum + sku.stock, 0);
    const firstSku = v.skus[0];
    return {
      id: v.id || `var-${product.id}-${idx}`,
      productId: String(product.id),
      sku: firstSku?.articleId
        ? String(firstSku.articleId)
        : `SKU-${product.id}-${idx}`,
      name: `${product.name} (${v.colorName})`,
      price: {
        amount: product.price,
        currency: 'USD',
      },
      available: totalStock > 0,
      optionValues: {
        Color: v.colorName,
      },
      inventory: {
        availableQuantity: totalStock,
        reservedQuantity: 0,
      },
      media: v.images.map((img, i) => ({
        id: img.id,
        kind: 'image' as const,
        url: img.url,
        alt: `${product.name} - ${v.colorName}`,
        position: i,
      })),
    };
  });

  return {
    id: String(product.id),
    slug: slug || `product-${product.id}`,
    name: product.name,
    description: product.description,
    status: 'active',
    categories: [category],
    collections: [],
    media:
      allMedia.length > 0
        ? allMedia
        : [
            {
              id: `media-${product.id}`,
              kind: 'image',
              url: '/assets/placeholder.webp',
              alt: product.name,
              position: 0,
            },
          ],
    options: [
      {
        id: 'color',
        name: 'Color',
        values: product.variants.map((v) => v.colorName),
      },
    ],
    variants,
  };
}

export function mapNovaProductsToCatalog(
  products: NovaProduct[],
): CatalogProduct[] {
  return products.map(mapNovaProductToCatalog);
}
