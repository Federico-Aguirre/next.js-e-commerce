import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

import type { CatalogProduct } from '@/commerce/catalog-domain';
import { Link } from '@/lib/I18nRouting';

import { Price } from './Price';

type ProductCardProps = {
  product: CatalogProduct;
  locale: string;
  priority?: boolean;
  outOfStockLabel: string;
};

export function ProductCard({
  product,
  locale,
  priority = false,
  outOfStockLabel,
}: ProductCardProps) {
  const [firstVariant] = product.variants;
  const firstMedia = product.media[0] ?? firstVariant?.media[0];

  if (!firstVariant || !firstMedia) {
    return null;
  }

  return (
    <article className="group flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="relative overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-zinc-900"
      >
        <div className="aspect-[4/5] overflow-hidden">
          <Image
            src={firstMedia.url}
            alt={firstMedia.alt ?? product.name}
            width={firstMedia.width ?? 800}
            height={firstMedia.height ?? 1000}
            priority={priority}
            className="h-full w-full object-contain p-2 transition duration-500 ease-out group-hover:scale-[1.03]"
          />
        </div>
        <span className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition-transform duration-300 group-hover:rotate-12">
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </span>
        {firstVariant.available ? null : (
          <span className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium backdrop-blur">
            {outOfStockLabel}
          </span>
        )}
      </Link>

      <div className="flex items-start justify-between gap-4 pt-4">
        <div className="min-w-0">
          <Link
            href={`/products/${product.slug}`}
            className="font-medium hover:underline"
          >
            {product.name}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {product.description}
          </p>
        </div>
        <Price
          money={firstVariant.price}
          locale={locale}
          compareAt={firstVariant.compareAtPrice}
          className="shrink-0 text-sm"
        />
      </div>
    </article>
  );
}
