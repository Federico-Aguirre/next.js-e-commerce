import type { CatalogProduct } from '@/commerce/catalog-domain';

import { ProductCard } from './ProductCard';

type ProductGridProps = {
  products: readonly CatalogProduct[];
  locale: string;
  outOfStockLabel: string;
};

export function ProductGrid({
  products,
  locale,
  outOfStockLabel,
}: ProductGridProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          locale={locale}
          priority={index < 2}
          outOfStockLabel={outOfStockLabel}
        />
      ))}
    </div>
  );
}
