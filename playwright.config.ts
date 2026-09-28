import { defineConfig, devices } from '@playwright/test';

process.env.PLAYWRIGHT_HTML_REPORT = 'playwright-report';
process.env.PLAYWRIGHT_OUTPUT_DIR = 'test-results';
process.env.TS_NODE_COMPILER_OPTIONS = '{"module":"commonjs"}';

const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  // 1. Ubicación de los archivos de prueba
  testDir: './tests',

  // 2. Ubicación de artefactos (capturas, videos, trazas) dentro del proyecto
  outputDir: './test-results',

  // 3. Configuración de reportes
  reporter: [['list'], ['html']],

  testMatch: '**/*.spec.ts',
  fullyParallel: true,

  use: {
    baseURL: BASE_URL,
    trace: 'off',
    video: 'off',
  },

  /* Servidor web para CI/CD y ejecuciones locales */
  webServer: {
    // Forzamos a Next.js a escuchar en el mismo puerto que Playwright consulta (-p 3001)
    command: `npm run build && npm start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000, // 3 minutos en milisegundos para dar tiempo al build en CI
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
