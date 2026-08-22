import { test, expect } from '@playwright/test';

test.describe('🔒 Historial de Usuario Autenticado', () => {

  test('Debería renderizar los estados vacíos si el usuario no tiene compras', async ({ page }) => {
    // 💡 TRUCO DE PORTFOLIO: Mockeamos la sesión inyectando una cookie falsa o interceptando la API
    await page.route('/api/orders', async (route) => {
      // Simulamos que la API de Aiven responde un array vacío de órdenes
      await route.fulfill({ json: [] });
    });

    await page.goto('/historial');

    // Comprobamos que el diseño maneja la experiencia de usuario de forma fluida
    await expect(page.locator('text=No tenés compras registradas todavía.')).toBeVisible();
  });
  
});