import { createHash } from 'node:crypto';

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  now?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/**
 * Per-process fallback throttling for defense in depth. In serverless/multi-instance
 * deployments this is not a substitute for a shared edge/WAF rate limiter.
 */
export function checkRateLimit(
  key: string,
  { limit, windowMs, now = Date.now() }: RateLimitOptions,
): RateLimitResult {
  if (!key || !Number.isInteger(limit) || limit < 1 || windowMs < 1) {
    throw new Error('Invalid rate limit configuration.');
  }

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (buckets.size > MAX_BUCKETS) {
    for (const [entryKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(entryKey);
    }
    while (buckets.size > MAX_BUCKETS) {
      const oldest = buckets.keys().next();
      if (oldest.done) break;
      buckets.delete(oldest.value);
    }
  }

  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

function readHeaderValue(value: unknown): string {
  if (Array.isArray(value)) return readHeaderValue(value.at(-1));
  return typeof value === 'string' ? value.trim() : '';
}

/** Read IP headers from either a Fetch Request or NextAuth's RequestInternal. */
export function getRequestClientIpFromHeaders(headers: Record<string, unknown>): string {
  const direct =
    readHeaderValue(headers['cf-connecting-ip']) || readHeaderValue(headers['x-real-ip']);

  if (direct && direct.length <= 64) return direct;

  // Reverse proxies append the observed client address; do not trust the first,
  // potentially attacker-controlled entry in a comma-separated X-Forwarded-For chain.
  const forwarded = readHeaderValue(headers['x-forwarded-for']);
  const last = forwarded.split(',').at(-1)?.trim();
  return last && last.length <= 64 ? last : 'unknown';
}

export function getRequestClientIp(request: Request): string {
  return getRequestClientIpFromHeaders({
    'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
    'x-real-ip': request.headers.get('x-real-ip'),
    'x-forwarded-for': request.headers.get('x-forwarded-for'),
  });
}

export function hashRateLimitIdentity(identity: string): string {
  return createHash('sha256').update(identity.trim().toLowerCase()).digest('hex');
}
