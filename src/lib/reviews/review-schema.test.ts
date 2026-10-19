import { describe, expect, it } from 'vitest';
import { productReviewInputSchema } from './review-schema';

describe('productReviewInputSchema', () => {
  it('accepts ratings at the supported limits', () => {
    expect(productReviewInputSchema.safeParse({ rating: 1 }).success).toBe(true);
    expect(productReviewInputSchema.safeParse({ rating: 5 }).success).toBe(true);
  });

  it.each([0, 6, 2.5, '5'])('rejects invalid rating %s', (rating) => {
    expect(productReviewInputSchema.safeParse({ rating }).success).toBe(false);
  });

  it('trims optional comments and accepts a star-only review', () => {
    expect(productReviewInputSchema.parse({ rating: 4, comment: '  Buena calidad  ' })).toEqual({
      rating: 4,
      comment: 'Buena calidad',
    });
    expect(productReviewInputSchema.parse({ rating: 3 })).toEqual({
      rating: 3,
      comment: '',
    });
  });

  it('rejects comments longer than 1,000 characters', () => {
    expect(
      productReviewInputSchema.safeParse({ rating: 5, comment: 'x'.repeat(1001) }).success,
    ).toBe(false);
  });
});
