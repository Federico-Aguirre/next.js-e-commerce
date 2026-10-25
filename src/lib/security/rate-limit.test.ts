import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkRateLimit,
  getRequestClientIp,
  getRequestClientIpFromHeaders,
  hashRateLimitIdentity,
} from './rate-limit';

describe('per-process rate limit', () => {
  it('allows requests up to the configured limit and blocks subsequent requests', () => {
    const key = `login:${Math.random()}`;
    expect(checkRateLimit(key, { limit: 2, windowMs: 60_000, now: 1000 }).allowed).toBe(true);
    expect(checkRateLimit(key, { limit: 2, windowMs: 60_000, now: 1001 }).allowed).toBe(true);
    expect(checkRateLimit(key, { limit: 2, windowMs: 60_000, now: 1002 })).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
    });
  });

  it('resets expired windows', () => {
    const key = `register:${Math.random()}`;
    checkRateLimit(key, { limit: 1, windowMs: 1000, now: 1000 });
    expect(checkRateLimit(key, { limit: 1, windowMs: 1000, now: 2000 }).allowed).toBe(true);
  });

  it('uses a trusted direct IP header and the last forwarded address as fallback', () => {
    const forwardedRequest = new Request('https://shop.example/api', {
      headers: { 'x-forwarded-for': 'spoofed, proxy, 203.0.113.8' },
    });
    expect(getRequestClientIp(forwardedRequest)).toBe('203.0.113.8');

    const cfRequest = new Request('https://shop.example/api', {
      headers: { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': 'spoofed' },
    });
    expect(getRequestClientIp(cfRequest)).toBe('203.0.113.9');
  });

  it('accepts the header shape provided by NextAuth and avoids the first forwarded entry', () => {
    expect(
      getRequestClientIpFromHeaders({
        'x-forwarded-for': 'attacker-controlled, 198.51.100.2',
      }),
    ).toBe('198.51.100.2');
    expect(
      getRequestClientIpFromHeaders({
        'cf-connecting-ip': '198.51.100.3',
        'x-forwarded-for': 'attacker-controlled',
      }),
    ).toBe('198.51.100.3');
    expect(
      getRequestClientIpFromHeaders({
        'x-forwarded-for': ['attacker-controlled', '203.0.113.10'],
      }),
    ).toBe('203.0.113.10');
  });

  it('hashes identities without exposing their original value', () => {
    const hash = hashRateLimitIdentity('User@Example.com');
    expect(hash).toBe(hashRateLimitIdentity(' user@example.com '));
    expect(hash).not.toContain('user');
    expect(hash).toHaveLength(64);
  });
});
