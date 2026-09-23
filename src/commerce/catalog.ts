import type {
  CatalogQuery,
  Pagination,
  PriceFilter,
  CatalogSort,
} from './contracts';

export const DEFAULT_CATALOG_PAGE_SIZE = 24;
export const MAX_CATALOG_PAGE_SIZE = 100;

export const DEFAULT_CATALOG_SORT: CatalogSort = {
  field: 'relevance',
  direction: 'desc',
};

const normalizePage = (page: number | undefined): number => {
  if (!Number.isInteger(page) || (page ?? 0) < 1) {
    return 1;
  }

  return page ?? 1;
};

const normalizePageSize = (pageSize: number | undefined): number => {
  if (!Number.isInteger(pageSize) || (pageSize ?? 0) < 1) {
    return DEFAULT_CATALOG_PAGE_SIZE;
  }

  return Math.min(pageSize ?? DEFAULT_CATALOG_PAGE_SIZE, MAX_CATALOG_PAGE_SIZE);
};

const normalizePriceFilter = (
  price: PriceFilter | undefined,
): PriceFilter | undefined => {
  if (!price) {
    return undefined;
  }

  const min =
    price.min !== undefined && Number.isFinite(price.min)
      ? Math.max(0, price.min)
      : undefined;
  const max =
    price.max !== undefined && Number.isFinite(price.max)
      ? Math.max(0, price.max)
      : undefined;

  if (min !== undefined && max !== undefined && min > max) {
    return { min: max, max: min };
  }

  if (min === undefined && max === undefined) {
    return undefined;
  }

  return { min, max };
};

export const normalizeCatalogQuery = (query: CatalogQuery): CatalogQuery => {
  const legacyPageSize = query.limit;
  const legacyPage =
    query.offset !== undefined && legacyPageSize
      ? Math.floor(Math.max(query.offset, 0) / legacyPageSize) + 1
      : undefined;

  const pagination: Pagination = {
    page: normalizePage(query.pagination?.page ?? legacyPage),
    pageSize: normalizePageSize(query.pagination?.pageSize ?? legacyPageSize),
  };

  return {
    ...query,
    query: query.query?.trim() ?? undefined,
    filters: query.filters
      ? {
          ...query.filters,
          optionValues: query.filters.optionValues
            ? (() => {
                const normalized: Record<string, readonly string[]> = {};

                for (const [key, values] of Object.entries(
                  query.filters.optionValues,
                )) {
                  const normalizedValues = values
                    .filter(
                      (value): value is string => typeof value === 'string',
                    )
                    .map((value) => value.trim())
                    .filter(Boolean);

                  if (normalizedValues.length > 0) {
                    normalized[key] = normalizedValues;
                  }
                }

                return normalized;
              })()
            : undefined,
          price: normalizePriceFilter(query.filters.price),
        }
      : undefined,
    sort: query.sort ?? DEFAULT_CATALOG_SORT,
    pagination,
    limit: undefined,
    offset: undefined,
  };
};

export const getCatalogOffset = (pagination: Pagination): number => {
  const page = normalizePage(pagination.page);
  const pageSize = normalizePageSize(pagination.pageSize);

  return (page - 1) * pageSize;
};
