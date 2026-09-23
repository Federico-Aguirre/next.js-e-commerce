'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type {
  CatalogCategory,
  CatalogFilterOptions,
} from '@/commerce/catalog-domain';

type CatalogFiltersProps = {
  categories: readonly CatalogCategory[];
  searchParams: Record<string, string | undefined>;
  options: CatalogFilterOptions;
};

export function CatalogFilters({
  categories,
  searchParams,
  options,
}: CatalogFiltersProps) {
  const t = useTranslations('Storefront.catalog');
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  const currentCategory = currentSearchParams.get('category') ?? '';
  const currentSort = currentSearchParams.get('sort') ?? 'featured';

  const updateFilter = (name: string, value: string) => {
    const params = new URLSearchParams(currentSearchParams.toString());

    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }

    params.delete('page');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t('categoryLabel')}
          </span>
          <select
            name="category"
            value={currentCategory}
            onChange={(event) => updateFilter('category', event.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t('allCategories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        {[
          [
            'color',
            'Color',
            options.colors.map((item) => ({
              value: item.id,
              label: item.name,
            })),
          ],
          [
            'size',
            'Size',
            options.sizes.map((item) => ({ value: item, label: item })),
          ],
          [
            'brand',
            'Brand',
            options.brands.map((item) => ({ value: item, label: item })),
          ],
          [
            'gender',
            'Gender',
            options.genders.map((item) => ({ value: item, label: item })),
          ],
          [
            'material',
            'Material',
            options.materials.map((item) => ({ value: item, label: item })),
          ],
        ].map(([name, label, values]) => (
          <label key={name as string} className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {label as string}
            </span>
            <select
              value={currentSearchParams.get(name as string) ?? ''}
              onChange={(event) =>
                updateFilter(name as string, event.target.value)
              }
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All</option>
              {(values as { value: string; label: string }[]).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t('sortLabel')}
          </span>
          <select
            name="sort"
            value={currentSort}
            onChange={(event) => updateFilter('sort', event.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="featured">{t('sortFeatured')}</option>
            <option value="price-asc">{t('sortPriceAsc')}</option>
            <option value="price-desc">{t('sortPriceDesc')}</option>
            <option value="name-asc">{t('sortNameAsc')}</option>
            <option value="rating-desc">{t('sortRatingDesc')}</option>
          </select>
        </label>

        <div className="flex items-center gap-3">
          <label className="flex min-h-10 flex-1 items-center gap-2 rounded-lg border border-border px-3 text-sm">
            <input
              type="checkbox"
              name="availability"
              value="in-stock"
              checked={currentSearchParams.get('availability') === 'in-stock'}
              onChange={(event) =>
                updateFilter(
                  'availability',
                  event.target.checked ? 'in-stock' : '',
                )
              }
              className="size-4 accent-[var(--primary)]"
            />
            <span>{t('inStockOnly')}</span>
          </label>
        </div>
      </div>
    </form>
  );
}
