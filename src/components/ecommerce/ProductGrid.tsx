import type { CatalogProduct } from '@/commerce/catalog-domain';
import { Price } from './Price';
import { ProductCard } from './ProductCard';

type ProductGridProps = {
  products: readonly CatalogProduct[];
  locale: string;
  outOfStockLabel: string;
};

export function ProductGrid({ products, locale, outOfStockLabel }: ProductGridProps) {
  if (products.length === 0) {
    return null;
  }

  const localePrefix = locale.startsWith('es') ? '/es' : '';

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
      {products.map((product, index) => {
        const firstVariant = product.variants[0];
        const firstMedia = product.media[0] ?? firstVariant?.media[0];
        if (!firstVariant || !firstMedia) return null;

        return (
          <ProductCard
            key={product.id}
            title={product.name}
            href={`${localePrefix}/products/${product.slug}`}
            imageSrc={firstMedia.url}
            imageAlt={firstMedia.alt ?? product.name}
            price={
              <Price
                money={firstVariant.price}
                locale={locale}
                compareAt={firstVariant.compareAtPrice}
                className="w-full min-w-0 text-sm"
              />
            }
            available={firstVariant.available}
            stockLabel={outOfStockLabel}
            priority={index < 2}
            showArrow
          />
        );
      })}
    </div>
  );
}
