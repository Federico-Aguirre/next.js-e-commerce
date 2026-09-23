import { describe, expect, it } from 'vitest';

import { assertIdempotencyKey } from './validation';

describe('commerce validation', () => {
  it('accepts a stable idempotency key', () => {
    expect(assertIdempotencyKey('checkout-2026-09-20-123456')).toBe(
      'checkout-2026-09-20-123456',
    );
  });

  it('rejects empty or oversized idempotency keys', () => {
    expect(() => assertIdempotencyKey('short')).toThrow('16 to 255');
    expect(() => assertIdempotencyKey('x'.repeat(256))).toThrow('16 to 255');
  });
});
