import { test, expect, Locator, Page } from '@playwright/test';

class CatalogPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly productCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder('Buscar productos por nombre...');
    // Apuntamos a los contenedores o enlaces de las tarjetas que tengan el botón de ver detalle
    this.productCards = page.locator('a:has-text("Ver detalle")');
  }

  async navegar() {
    await this.page.goto('/');
  }

  async buscarProducto(nombre: string) {
    await this.searchInput.fill(nombre);
    // Esperamos a que la URL cambie reflejando el filtro
    await this.page.waitForURL(new RegExp(`.*search=${nombre}`), { timeout: 5000 });
  }

  async verificarProductosVisibles() {
    // El robot espera que al menos la primera tarjeta de producto aparezca en la grilla
    await expect(this.productCards.first()).toBeVisible({ timeout: 5000 });
  }
}

test.describe('🛒 Flujo de Catálogo - Senior Store', () => {
  
  test('Debería filtrar los productos mediante Query Params en la URL', async ({ page }) => {
    const catalogo = new CatalogPage(page);
    
    await catalogo.navegar();
    
    // Buscamos "shoes" que sabemos que devuelve resultados reales de tu base de datos
    await catalogo.buscarProducto('shoes'); 
    
    // 🚀 AHORA SÍ: Validamos que se muestren los productos en pantalla
    await catalogo.verificarProductosVisibles();
  });

});