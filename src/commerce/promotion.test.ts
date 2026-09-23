import { describe, expect, it } from 'vitest';

import { calculatePromotionDiscount } from './promotion';
import type { Promotion } from './promotion';

const percentage: Promotion = {
  id: 'promo-10',
  code: 'SAVE10',
  type: 'percentage',
  value: 10,
};

const fixed: Promotion = {
  id: 'promo-20',
  code: 'SAVE20',
  type: 'fixed',
  value: 20,
  currency: 'USD',
};

describe('promotion discount calculation', () => {
  it('calculates percentage discounts without exceeding the subtotal', () => {
    expect(
      calculatePromotionDiscount(percentage, { amount: 100, currency: 'USD' }),
    ).toStrictEqual({
      promotionId: 'promo-10',
      discount: { amount: 10, currency: 'USD' },
    });
    expect(
      calculatePromotionDiscount(
        { ...percentage, value: 150 },
        { amount: 100, currency: 'USD' },
      ),
    ).toStrictEqual({
      promotionId: 'promo-10',
      discount: { amount: 100, currency: 'USD' },
    });
  });

  it('calculates fixed discounts and caps them at the subtotal', () => {
    expect(
      calculatePromotionDiscount(fixed, { amount: 100, currency: 'USD' }),
    ).toStrictEqual({
      promotionId: 'promo-20',
      discount: { amount: 20, currency: 'USD' },
    });
    expect(
      calculatePromotionDiscount(fixed, { amount: 10, currency: 'USD' }),
    ).toStrictEqual({
      promotionId: 'promo-20',
      discount: { amount: 10, currency: 'USD' },
    });
  });

  it('rejects mismatched currencies and invalid values', () => {
    expect(() =>
      calculatePromotionDiscount(fixed, { amount: 100, currency: 'EUR' }),
    ).toThrow('currency');
    expect(() =>
      calculatePromotionDiscount(percentage, { amount: -1, currency: 'USD' }),
    ).toThrow('non-negative');
  });
});
