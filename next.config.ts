import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Enable Next.js 16 Cache Components so data caches use `use cache` / `cacheLife`.
  cacheComponents: true,
  // Never expose server-only secrets through next.config.env.
  // CORS is enforced only in src/proxy.ts via an explicit allowlist; do not add CORS headers here.
  // These patterns are for Next.js development host checks, not CORS permissions.
  allowedDevOrigins: ['*.nip.io', '192.168.3.9.nip.io', '*.ngrok-free.app', '*.ngrok-free.dev'],
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ...(process.env.NODE_ENV === 'production'
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
        : []),
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Public product images have stable names (unlike hashed Next.js assets).
        // A short browser cache reduces repeat downloads without keeping updates stale for long.
        source: '/assets/images/products/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
