import { expect, type Locator, type Page } from '@playwright/test';

export type CatalogSortOption =
  | 'featured'
  | 'price-asc'
  | 'price-desc'
  | 'name-asc'
  | 'rating-desc';

/**
 * Page Object for the customer-facing product catalog.
 * Keeps selectors and common catalog interactions out of the specs.
 */
export class CatalogPage {
  readonly page: Page;
  readonly title: Locator;
  readonly sortSelect: Locator;
  readonly productCards: Locator;
  readonly emptyStateTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByRole('heading', { level: 1 });
    this.sortSelect = page.locator('select[name="sort"]');
    this.productCards = page.locator('article.group');
    this.emptyStateTitle = page.getByRole('heading', {
      name: /no products match those filters|ningún producto coincide/i,
    });
  }

  async goto() {
    await this.page.goto('/products');
  }

  async expectLoaded() {
    await expect(this.title).toBeVisible();
    await expect(this.sortSelect).toBeVisible();
  }

  async sortBy(option: CatalogSortOption) {
    await this.sortSelect.selectOption(option);
  }
}
