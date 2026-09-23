/**
 * @file sitemap.ts
 * @description Dynamic XML sitemap generator for Next.js App Router.
 * Automatically generates a search-engine-friendly sitemap to improve indexation and SEO visibility.
 */

import type { MetadataRoute } from 'next';

import { routing } from '@/lib/I18nRouting';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();

  // Define the static routes of your application here
  const routes = ['', '/about'];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    alternates: {
      languages: Object.fromEntries(
        routing.locales
          .filter((locale) => locale !== routing.defaultLocale)
          .map((locale) => [locale, `${baseUrl}${getI18nPath(route, locale)}`]),
      ),
    },
  }));
}
