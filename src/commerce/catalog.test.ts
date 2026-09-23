import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CATALOG_PAGE_SIZE,
  MAX_CATALOG_PAGE_SIZE,
  getCatalogOffset,
  normalizeCatalogQuery,
} from './catalog';

describe('catalog query normalization', () => {
  it('uses bounded page-based pagination and a stable default sort', () => {
    const query = normalizeCatalogQuery({
      query: '  shoes ',
      pagination: { page: 0, pageSize: 500 },
    });

    expect(query).toMatchObject({
      query: 'shoes',
      sort: { field: 'relevance', direction: 'desc' },
      pagination: {
        page: 1,
        pageSize: MAX_CATALOG_PAGE_SIZE,
      },
    });
    if (!query.pagination) {
      throw new Error('Expected normalized pagination');
    }
    expect(getCatalogOffset(query.pagination)).toBe(0);
  });

  it('preserves legacy limit/offset callers while producing page pagination', () => {
    const query = normalizeCatalogQuery({
      limit: 12,
      offset: 24,
    });

    expect(query.pagination).toStrictEqual({
      page: 3,
      pageSize: 12,
    });
    expect(query.limit).toBeUndefined();
    expect(query.offset).toBeUndefined();
    if (!query.pagination) {
      throw new Error('Expected normalized pagination');
    }
    expect(getCatalogOffset(query.pagination)).toBe(24);
  });

  it('normalizes facet option values and price ranges', () => {
    const query = normalizeCatalogQuery({
      filters: {
        optionValues: {
          color: [' red ', '', 'blue '],
          size: [' '],
        },
        price: {
          min: 80,
          max: 20,
        },
      },
      pagination: {
        page: 2,
        pageSize: DEFAULT_CATALOG_PAGE_SIZE,
      },
    });

    expect(query.filters).toStrictEqual({
      optionValues: {
        color: ['red', 'blue'],
      },
      price: {
        min: 20,
        max: 80,
      },
    });
  });
});
