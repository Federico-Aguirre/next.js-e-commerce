import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/app/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    'src/database/**/*.{ts,tsx}',
    'src/lib/**/*.{ts,tsx}',
    'src/store/**/*.{ts,tsx}',
    'src/types/**/*.{ts,tsx}',
    'tests/e2e/**/*.{ts,tsx}',
    'checkly.config.ts',
  ],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: [
    '@sentry/nextjs',
    '@tanstack/react-query',
    'sharp',
    'sonner',
    '@faker-js/faker',
    '@types/bcryptjs',
    'vitest-browser-react',
  ],
  ignoreBinaries: ['commit'],
};

export default config;
