import { productsData } from '@/data/products';
import type { Product } from '@/types/product';

import type {
  CatalogCategory,
  CatalogMedia,
  CatalogProduct,
} from './catalog-domain';

type CatalogTranslator = (key: never) => string;

const categoryKeys = {
  jackets: 'jackets',
  pants: 'pants',
  sneakers: 'shoes',
  hoodies: 'sweatshirts',
  tshirts: 'tshirts',
} as const;

const translateKey = (translate: CatalogTranslator, key: string) =>
  translate(key as never);

const toCategorySlug = (category: string) =>
  categoryKeys[category as keyof typeof categoryKeys] ?? category;

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
          { articleId: sku.articleId, stock: sku.stock },
        ]),
      ),
      inventory: {
        availableQuantity: variant.skus.reduce(
          (total, sku) => total + sku.stock,
          0,
        ),
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
    status: 'active',
    categories: categories.filter(
      (category) => category.slug === toCategorySlug(product.category),
    ),
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
          ...new Set(
            product.variants.flatMap((variant) =>
              variant.skus.map((sku) => sku.size),
            ),
          ),
        ],
      },
    ],
    variants,
  };
};

export function createProductCatalog(translate: CatalogTranslator) {
  const sourceCategories = [
    ...new Set(productsData.map((product) => product.category)),
  ];
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

  return {
    products: productsData.map((product) =>
      toCatalogProduct(product, categories),
    ),
    categories,
  } as const;
}
