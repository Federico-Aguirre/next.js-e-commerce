import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAllowedCorsOrigins, getCorsHeadersForOrigin, normalizeExplicitOrigin } from './cors';

describe('explicit CORS origin allowlist', () => {
  it('normalizes exact configured origins and rejects wildcards', () => {
    const allowed = buildAllowedCorsOrigins({
      configuredOrigins:
        ' https://shop.example.com, https://admin.example.com/ , https://*.evil.example',
      nodeEnv: 'production',
    });

    expect([...allowed]).toEqual(['https://shop.example.com', 'https://admin.example.com']);
    expect(allowed.has('https://sub.shop.example.com')).toBe(false);
  });

  it('rejects malformed origins, paths, credentials, and non-web schemes', () => {
    expect(normalizeExplicitOrigin('')).toBeNull();
    expect(normalizeExplicitOrigin('https://shop.example.com/account')).toBeNull();
    expect(normalizeExplicitOrigin('https://user:pass@shop.example.com')).toBeNull();
    expect(normalizeExplicitOrigin('file:///etc/passwd')).toBeNull();
    expect(normalizeExplicitOrigin('https://*.example.com')).toBeNull();
    expect(normalizeExplicitOrigin('not a url')).toBeNull();
  });

  it('includes only explicit site URLs and excludes development origins in production', () => {
    const allowed = buildAllowedCorsOrigins({
      configuredOrigins: 'https://mobile.example.com',
      siteUrls: ['https://shop.example.com/', 'https://shop.example.com/products'],
      nodeEnv: 'production',
    });

    expect(allowed.has('https://mobile.example.com')).toBe(true);
    expect(allowed.has('https://shop.example.com')).toBe(true);
    expect(allowed.has('http://localhost:3001')).toBe(false);
  });

  it('adds limited localhost origins only outside production', () => {
    const allowed = buildAllowedCorsOrigins({ nodeEnv: 'development' });

    expect(allowed.has('http://localhost:3001')).toBe(true);
    expect(allowed.has('http://127.0.0.1:3001')).toBe(true);
    expect(allowed.has('http://localhost:8081')).toBe(true);
  });

  it('returns credentialed headers only for an exact allowlisted origin', () => {
    const allowed = buildAllowedCorsOrigins({
      configuredOrigins: 'https://shop.example.com',
      nodeEnv: 'production',
    });

    expect(getCorsHeadersForOrigin('https://shop.example.com', allowed)).toEqual({
      'Access-Control-Allow-Origin': 'https://shop.example.com',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Requested-With, Accept, ngrok-skip-browser-warning',
      Vary: 'Origin',
      'Cache-Control': 'no-store',
    });
    expect(getCorsHeadersForOrigin('https://shop.example.com.attacker.test', allowed)).toBeNull();
    expect(getCorsHeadersForOrigin('https://attacker.test', allowed)).toBeNull();
    expect(getCorsHeadersForOrigin(null, allowed)).toBeNull();
  });

  it('does not turn wildcard entries into a public allow-all policy', () => {
    const allowed = buildAllowedCorsOrigins({
      configuredOrigins: '*',
      nodeEnv: 'production',
    });

    expect(allowed.size).toBe(0);
    expect(getCorsHeadersForOrigin('https://attacker.test', allowed)).toBeNull();
  });

  it('keeps CORS centralized and removes the destructive public seed route', () => {
    const root = process.cwd();
    const nextConfig = readFileSync(resolve(root, 'next.config.ts'), 'utf8');
    const proxy = readFileSync(resolve(root, 'src/proxy.ts'), 'utf8');
    const graphqlRoute = readFileSync(resolve(root, 'src/app/api/graphql/route.ts'), 'utf8');

    expect(nextConfig).not.toContain('Access-Control-Allow-Origin');
    expect(nextConfig).not.toContain('Access-Control-Allow-Credentials');
    expect(nextConfig).toContain("source: '/assets/images/products/:path*'");
    expect(nextConfig).toContain('public, max-age=86400, stale-while-revalidate=604800');
    expect(proxy).toContain('buildAllowedCorsOrigins');
    expect(proxy).toContain('Forbidden origin');
    expect(graphqlRoute).toContain('cors: false');
    expect(graphqlRoute).not.toContain("origin: '*'");
    expect(existsSync(resolve(root, 'src/app/api/seed/route.ts'))).toBe(false);
  });
});
