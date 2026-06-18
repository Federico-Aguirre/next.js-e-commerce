import { defineConfig, devices } from '@playwright/test';

process.env.PLAYWRIGHT_HTML_REPORT = 'playwright-report';
process.env.PLAYWRIGHT_OUTPUT_DIR = 'test-results';
process.env.TS_NODE_COMPILER_OPTIONS = '{"module":"commonjs"}'; 

export default defineConfig({
  testDir: './tests',
  /* 🎯 CLAVE: Playwright SOLO va a leer archivos que terminen en .spec.ts */
  testMatch: '**/*.spec.ts', 
  fullyParallel: true,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    video: 'off',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});