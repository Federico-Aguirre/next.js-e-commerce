import { defineConfig, devices } from '@playwright/test';

process.env.PLAYWRIGHT_HTML_REPORT = 'playwright-report';
process.env.PLAYWRIGHT_OUTPUT_DIR = 'test-results';
process.env.TS_NODE_COMPILER_OPTIONS = '{"module":"commonjs"}';

export default defineConfig({
  // 1. Dónde están ubicados tus archivos de prueba
  testDir: './tests',

  // 2. Dónde guardar artefactos de ejecuciones (capturas, videos, trazas)
  outputDir: '../tests/test-results',

  // 3. Configuración de reportes (combina consola y HTML)
  reporter: [['list'], ['html']],

  testMatch: '**/*.spec.ts',
  fullyParallel: true,

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001',
    trace: 'off',
    video: 'off',
  },

  /* Dejamos solo la versión que compila y sirve para CI/CD y local */
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 1200,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
