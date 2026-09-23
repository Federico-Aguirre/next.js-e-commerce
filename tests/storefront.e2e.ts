import { expect, test } from '@playwright/test';

test.describe('storefront smoke flow', () => {
  test('renders the localized home page with accessible primary navigation', async ({
    page,
  }) => {
    await page.goto('/en');

    await expect(page).toHaveTitle(/Your Store/u);
    await expect(
      page.getByRole('navigation', { name: /primary navigation/iu }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /catalog/iu }).first(),
    ).toBeVisible();
    await expect(page.getByLabel(/search/iu).first()).toBeVisible();
  });

  test('filters the catalog and opens a product detail page', async ({
    page,
  }) => {
    await page.goto('/en/products?q=lamp');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('#catalog-search')).toHaveValue('lamp');

    await expect(
      page.getByRole('link', { name: /arc lamp/iu }).first(),
    ).toBeVisible();
    await page
      .getByRole('link', { name: /arc lamp/iu })
      .first()
      .click();
    await expect(page).toHaveURL(/\/products\/arc-lamp$/u);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /arc lamp/iu,
    );
    await expect(
      page.getByRole('button', { name: /add to cart/iu }),
    ).toBeVisible();
  });

  test('serves the Spanish storefront route', async ({ page }) => {
    await page.goto('/es/products');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
