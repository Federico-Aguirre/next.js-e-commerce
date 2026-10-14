import 'server-only';
import { productsData } from '@/data/products';
import { prisma } from '@/lib/prisma';
import type { Product } from '@/types/product';
import type { CatalogCategory, CatalogMedia, CatalogProduct } from './catalog-domain';

type CatalogTranslator = (key: never) => string;

const categoryKeys = {
  jackets: 'jackets',
  pants: 'pants',
  sneakers: 'shoes',
  hoodies: 'sweatshirts',
  tshirts: 'tshirts',
} as const;

const translateKey = (translate: CatalogTranslator, key: string) => translate(key as never);

const toCategorySlug = (category: string) =>
  categoryKeys[category as keyof typeof categoryKeys] ?? category;

const normalizeVariantName = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('grey', 'gray')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

const mediaFromImage = (
  image: { id: string; url: string },
  alt: string,
  position: number,
): CatalogMedia => ({
  id: `media-${image.id}`,
  kind: 'image',
  url: image.url.replace(/^\/images\//, '/assets/images/'),
  alt,
  width: 800,
  height: 1000,
  position,
});

const toCatalogProduct = (
  product: Product,
  categories: readonly CatalogCategory[],
  status: CatalogProduct['status'] = 'active',
): CatalogProduct => {
  const productId = `prod-${product.id}`;
  const variants = product.variants.map((variant) => {
    const variantMedia = variant.images.map((image, index) =>
      mediaFromImage(image, `${product.name} - ${variant.colorName}`, index),
    );

    return {
      id: `${productId}-${variant.id}`,
      productId,
      sku: variant.skus[0]?.id ?? variant.id,
      name: variant.color?.name ?? variant.colorName,
      price: { amount: product.price, currency: 'USD' },
      available: variant.skus.some((sku) => sku.stock > 0),
      optionValues: { color: variant.color?.id ?? 'multicolor' },
      sizeStock: Object.fromEntries(
        variant.skus.map((sku) => [
          sku.size,
          { articleId: sku.articleId, stock: sku.stock, variantId: variant.id },
        ]),
      ),
      inventory: {
        availableQuantity: variant.skus.reduce((total, sku) => total + sku.stock, 0),
        reservedQuantity: 0,
      },
      media: variantMedia,
    };
  });

  return {
    id: productId,
    slug: product.slug ?? `product-${product.id}`,
    name: product.name,
    description: product.description,
    gender: product.gender,
    material: product.material,
    brand: product.brand,
    sku: product.sku,
    rating: product.rating,
    discount: product.discount,
    status,
    categories: categories.filter((category) => category.slug === toCategorySlug(product.category)),
    collections: [],
    media: variants.flatMap((variant) => variant.media),
    options: [
      {
        id: `${productId}-color`,
        name: 'Color',
        values: product.variants.map((variant) => variant.colorName),
      },
      {
        id: `${productId}-size`,
        name: 'Size',
        values: [
          ...new Set(product.variants.flatMap((variant) => variant.skus.map((sku) => sku.size))),
        ],
      },
    ],
    variants,
  };
};

export async function createProductCatalog(translate: CatalogTranslator) {
  const databaseProducts = await prisma.product.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      price: true,
      isActive: true,
      variants: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          colorName: true,
          skus: {
            orderBy: { articleId: 'asc' },
            select: {
              id: true,
              articleId: true,
              size: true,
              stock: true,
            },
          },
        },
      },
    },
  });

  const activeSourceProducts = databaseProducts.flatMap((databaseProduct) => {
    if (!databaseProduct.isActive) return [];
    const sourceProduct = productsData.find((product) => product.id === databaseProduct.id);
    return sourceProduct ? [sourceProduct] : [];
  });

  const sourceCategories = [...new Set(activeSourceProducts.map((product) => product.category))];
  const categories = sourceCategories.map((sourceCategory) => {
    const categorySlug = toCategorySlug(sourceCategory);

    return {
      id: `cat-${categorySlug}`,
      slug: categorySlug,
      name: categoryKeys[sourceCategory as keyof typeof categoryKeys]
        ? translateKey(translate, `categories.${categorySlug}`)
        : sourceCategory.charAt(0).toUpperCase() + sourceCategory.slice(1),
    };
  });

  const products = databaseProducts.flatMap((databaseProduct) => {
    if (!databaseProduct.isActive) return [];

    const sourceProduct = productsData.find((product) => product.id === databaseProduct.id);
    if (!sourceProduct) return [];

    const sourceVariantsByName = new Map(
      sourceProduct.variants.map((variant) => [
        normalizeVariantName(variant.sourceColorName ?? variant.colorName),
        variant,
      ]),
    );

    const variants = databaseProduct.variants.flatMap((databaseVariant, index) => {
      const sourceVariant =
        sourceVariantsByName.get(normalizeVariantName(databaseVariant.colorName)) ??
        sourceProduct.variants[index];

      if (!sourceVariant) return [];

      return [
        {
          ...sourceVariant,
          id: databaseVariant.id,
          sourceColorName: databaseVariant.colorName,
          skus: databaseVariant.skus.map((sku) => ({
            id: sku.id,
            articleId: sku.articleId,
            size: sku.size,
            stock: sku.stock,
          })),
        },
      ];
    });

    if (variants.length === 0) return [];

    const mergedProduct: Product = {
      ...sourceProduct,
      price: databaseProduct.price,
      variants,
    };

    return [toCatalogProduct(mergedProduct, categories)];
  });

  return { products, categories } as const;
}
