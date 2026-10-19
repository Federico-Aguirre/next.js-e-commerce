import { expect, test } from '@playwright/test';
import { CatalogPage } from './page-objects/catalog-page';

test.describe('Catálogo de productos', () => {
  test('muestra el título y los controles principales', async ({ page }) => {
    const catalog = new CatalogPage(page);

    await catalog.goto();
    await catalog.expectLoaded();
  });

  test('actualiza la URL al ordenar por precio ascendente', async ({ page }) => {
    const catalog = new CatalogPage(page);

    await catalog.goto();
    await catalog.expectLoaded();
    await catalog.sortBy('price-asc');

    await expect(page).toHaveURL(/(?:\?|&)sort=price-asc(?:&|$)/);
    await expect(catalog.sortSelect).toHaveValue('price-asc');
  });
});
