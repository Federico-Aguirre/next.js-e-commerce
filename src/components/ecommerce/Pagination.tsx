import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

type PaginationProps = {
  page: number;
  pageCount: number;
  query: Record<string, string | undefined>;
  previousLabel: string;
  nextLabel: string;
  navigationLabel: string;
  basePath: string;
};

function buildHref(
  page: number,
  query: Record<string, string | undefined>,
  basePath: string,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }

  params.set('page', String(page));
  return `${basePath}?${params.toString()}`;
}

export function Pagination({
  page,
  pageCount,
  query,
  previousLabel,
  nextLabel,
  navigationLabel,
  basePath,
}: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav
      className="flex items-center justify-between border-t border-border pt-6"
      aria-label={navigationLabel}
    >
      {page > 1 ? (
        <Button asChild variant="outline">
          <Link
            href={buildHref(page - 1, query, basePath)}
            aria-label={previousLabel}
          >
            <ChevronLeft className="mr-2 size-4" aria-hidden="true" />
            {previousLabel}
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          <ChevronLeft className="mr-2 size-4" aria-hidden="true" />
          {previousLabel}
        </Button>
      )}
      <p className="text-sm text-muted-foreground">
        {page} / {pageCount}
      </p>
      {page < pageCount ? (
        <Button asChild variant="outline">
          <Link
            href={buildHref(page + 1, query, basePath)}
            aria-label={nextLabel}
          >
            {nextLabel}
            <ChevronRight className="ml-2 size-4" aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          {nextLabel}
          <ChevronRight className="ml-2 size-4" aria-hidden="true" />
        </Button>
      )}
    </nav>
  );
}
