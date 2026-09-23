/**
 * @file robots.ts
 * @description Dynamic robots.txt generator for Next.js App Router.
 * Dictates web crawler permissions, specifies disallowed paths, and links directly to the XML sitemap.
 */

import type { MetadataRoute } from 'next';

import { getBaseUrl } from '@/utils/Helpers';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/'], // Define routes you do not want to index
    },
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
