export type CorsEnvironment = {
  configuredOrigins?: string;
  siteUrls?: Array<string | undefined>;
  nodeEnv?: string;
};

const DEVELOPMENT_ORIGINS = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:8081',
] as const;

/**
 * Accept only an exact HTTP(S) origin. Wildcards, paths, credentials, and other
 * schemes are rejected rather than interpreted broadly.
 */
export function normalizeExplicitOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('*')) return null;

  try {
    const parsed = new URL(trimmed);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Build the one shared allowlist used by proxy.ts. In production every
 * cross-origin value must come from explicit environment configuration.
 */
export function buildAllowedCorsOrigins({
  configuredOrigins = '',
  siteUrls = [],
  nodeEnv = process.env.NODE_ENV,
}: CorsEnvironment = {}): Set<string> {
  const origins = new Set<string>();

  for (const value of configuredOrigins.split(',')) {
    const origin = normalizeExplicitOrigin(value);
    if (origin) origins.add(origin);
  }

  for (const value of siteUrls) {
    if (!value) continue;
    const origin = normalizeExplicitOrigin(value);
    if (origin) origins.add(origin);
  }

  if (nodeEnv !== 'production') {
    for (const origin of DEVELOPMENT_ORIGINS) origins.add(origin);
  }

  return origins;
}

export function getCorsHeadersForOrigin(
  requestOrigin: string | null,
  allowedOrigins: ReadonlySet<string>,
): Record<string, string> | null {
  if (!requestOrigin) return null;

  const origin = normalizeExplicitOrigin(requestOrigin);
  if (!origin || !allowedOrigins.has(origin)) return null;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Accept, ngrok-skip-browser-warning',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
}
