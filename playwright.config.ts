import { defineConfig, devices } from '@playwright/test';

process.env.PLAYWRIGHT_HTML_REPORT = 'playwright-report';
process.env.PLAYWRIGHT_OUTPUT_DIR = 'test-results';
process.env.TS_NODE_COMPILER_OPTIONS = '{"module":"commonjs"}'; 

export default defineConfig({
  /* 📁 Corregido a 'test' en singular para que coincida con tus carpetas */
  testDir: './tests',
  
  /* 🎯 CLAVE: Playwright SOLO va a leer archivos que terminen en .spec.ts */
  testMatch: '**/*.spec.ts', 
  fullyParallel: true,
  reporter: 'html',
  
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'off',
    video: 'off',
  },

  /* 🚀 UNIFICADO: Dejamos solo la versión Senior que compila y sirve para CI/CD y local */
  webServer: {
    command: 'npm run build && npm start', 
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,  
    timeout: 120000,                       
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});