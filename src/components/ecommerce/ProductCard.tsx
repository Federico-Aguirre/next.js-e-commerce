import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Typography } from '@/components/ui/typography';
import { normalizeProductImageUrl } from '@/lib/catalog/product-image';
import { cn } from '@/lib/utils';

export type ProductCardProps = {
  title: string;
  href: string;
  imageSrc: string;
  imageAlt?: string;
  price: ReactNode;
  category?: string;
  stockLabel?: string;
  available?: boolean;
  priority?: boolean;
  imageSizes?: string;
  imageFit?: 'contain' | 'cover';
  imageClassName?: string;
  overlayAction?: ReactNode;
  footer?: ReactNode;
  showArrow?: boolean;
  className?: string;
};

/**
 * Single visual source for product tiles across the storefront, search, and wishlist.
 * Callers adapt their product data and price rules; this component owns card structure.
 */
export function ProductCard({
  title,
  href,
  imageSrc,
  imageAlt,
  price,
  category,
  stockLabel,
  available = true,
  priority = false,
  imageSizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  imageFit = 'contain',
  imageClassName,
  overlayAction,
  footer,
  showArrow = false,
  className,
}: ProductCardProps) {
  const resolvedImageSrc = normalizeProductImageUrl(imageSrc);

  return (
    <article className={cn('h-full min-w-0', className)}>
      <Card variant="interactive" padding="none" className="h-full gap-0">
        <div className="relative">
          <Link
            href={href}
            aria-label={title}
            className="group/image relative block aspect-[4/5] overflow-hidden bg-muted/30"
          >
            <Image
              src={resolvedImageSrc}
              alt={imageAlt ?? title}
              fill
              sizes={imageSizes}
              priority={priority}
              className={cn(
                'transition-transform duration-300 ease-out group-hover/image:scale-[1.03]',
                imageFit === 'contain' ? 'object-contain p-3 sm:p-4' : 'object-cover',
                imageClassName,
              )}
            />
            {showArrow && (
              <span className="pointer-events-none absolute top-3 right-3 grid size-9 place-items-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur transition-transform duration-300 group-hover/image:rotate-12">
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </span>
            )}
            {!available && stockLabel && (
              <Badge
                variant="warning"
                className="absolute bottom-3 left-3 bg-background/90 text-foreground shadow-sm backdrop-blur"
              >
                {stockLabel}
              </Badge>
            )}
          </Link>
          {overlayAction && <div className="absolute top-3 right-3 z-10">{overlayAction}</div>}
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
          {category && (
            <Badge variant="muted" className="mb-2 max-w-full self-start truncate">
              {category}
            </Badge>
          )}
          <Typography as="h3" variant="cardTitle" className="line-clamp-2 min-h-[2.8em]">
            <Link
              href={href}
              className="rounded-sm transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {title}
            </Link>
          </Typography>
          <div className="mt-3 w-full min-w-0">{price}</div>
          {footer && <div className="mt-auto pt-4">{footer}</div>}
        </div>
      </Card>
    </article>
  );
}
