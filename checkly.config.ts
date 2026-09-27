import { defineConfig } from 'checkly';

const checklyBaseUrl = process.env.CHECKLY_BASE_URL;
const enabled =
  process.env.CHECKLY_ENABLED === 'true' && Boolean(checklyBaseUrl);

export default defineConfig({
  projectName: 'next.js-e-commerce-main',
  logicalId: 'next.js-e-commerce-main',
  repoUrl: 'https://github.com/Federico-Aguirre/next.js-e-commerce',
  checks: {
    playwrightConfigPath: './playwright.config.ts',
    playwrightChecks: [
      {
        name: 'Production smoke test',
        logicalId: 'production-smoke-test',
        activated: enabled,
        muted: false,
        environmentVariables: checklyBaseUrl
          ? [{ key: 'CHECKLY_BASE_URL', value: checklyBaseUrl }]
          : [],
        pwProjects: ['chromium'],
        testCommand: 'npx playwright test tests/e2e/Sanity.check.e2e.ts',
        frequency: 10,
        locations: ['us-east-1'],
      },
    ],
  },
});
