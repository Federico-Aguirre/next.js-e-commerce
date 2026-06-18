import { Locator, Page, expect } from '@playwright/test';

export class CatalogPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly productCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder('Buscar productos por nombre...');
    this.productCards = page.locator('a:has-text("Ver detalle")');
  }

  async navegar() {
    await this.page.goto('/');
  }

  async buscarProducto(nombre: string) {
    await this.searchInput.fill(nombre);
    await this.page.waitForURL(new RegExp(`.*search=${nombre}`));
  }

  async verificarProductosVisibles() {
    await expect(this.productCards.first()).toBeVisible();
  }
}