import type { LocalePrefixMode } from 'next-intl/routing';

/** Locale prefix strategy for next-intl routing. */
const localePrefix: LocalePrefixMode = 'as-needed';

/** Centralized application configuration */
export const AppConfig = {
  name: 'My App',
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    localePrefix,
  },
};
