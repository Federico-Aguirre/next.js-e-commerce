import { describe, expect, it } from 'vitest';

import type { Cart } from './contracts';
import {
  calculateCartSubtotal,
  calculateOrderTotal,
  calculateTaxTotal,
} from './pricing';

const cart: Cart = {
  id: 'cart-1',
  currency: 'USD',
  lines: [
    {
      lineId: 'line-1',
      variantId: 'variant-1',
      quantity: 2,
      unitPrice: { amount: 25, currency: 'USD' },
    },
    {
      lineId: 'line-2',
      variantId: 'variant-2',
      quantity: 1,
      unitPrice: { amount: 10, currency: 'USD' },
    },
  ],
};

describe('commerce pricing', () => {
  it('calculates cart subtotal from server-side line prices', () => {
    expect(calculateCartSubtotal(cart)).toStrictEqual({
      amount: 60,
      currency: 'USD',
    });
  });

  it('calculates the order total without allowing a negative result', () => {
    expect(
      calculateOrderTotal({
        subtotal: { amount: 60, currency: 'USD' },
        shipping: { amount: 5, currency: 'USD' },
        tax: { amount: 6.5, currency: 'USD' },
        discount: { amount: 10, currency: 'USD' },
      }),
    ).toStrictEqual({
      amount: 61.5,
      currency: 'USD',
    });

    expect(() =>
      calculateOrderTotal({
        subtotal: { amount: 5, currency: 'USD' },
        shipping: { amount: 0, currency: 'USD' },
        tax: { amount: 0, currency: 'USD' },
        discount: { amount: 6, currency: 'USD' },
      }),
    ).toThrow('Order total cannot be negative');
  });

  it('rejects mixed currencies in order totals', () => {
    expect(() =>
      calculateOrderTotal({
        subtotal: { amount: 10, currency: 'USD' },
        shipping: { amount: 2, currency: 'EUR' },
        tax: { amount: 0, currency: 'USD' },
        discount: { amount: 0, currency: 'USD' },
      }),
    ).toThrow('same currency');
  });

  it('rejects mixed currencies in cart lines', () => {
    expect(() =>
      calculateCartSubtotal({
        ...cart,
        lines: [
          ...cart.lines,
          {
            lineId: 'line-3',
            variantId: 'variant-3',
            quantity: 1,
            unitPrice: { amount: 5, currency: 'EUR' },
          },
        ],
      }),
    ).toThrow('same currency');
  });

  it('rejects negative or non-finite monetary inputs', () => {
    expect(() =>
      calculateCartSubtotal({
        ...cart,
        lines: [
          {
            lineId: 'line-negative',
            variantId: 'variant-1',
            quantity: 1,
            unitPrice: { amount: -1, currency: 'USD' },
          },
        ],
      }),
    ).toThrow('non-negative finite');

    expect(() =>
      calculateOrderTotal({
        subtotal: { amount: 10, currency: 'USD' },
        shipping: { amount: -2, currency: 'USD' },
        tax: { amount: 0, currency: 'USD' },
        discount: { amount: 0, currency: 'USD' },
      }),
    ).toThrow('non-negative finite');

    expect(() =>
      calculateOrderTotal({
        subtotal: { amount: Number.NaN, currency: 'USD' },
        shipping: { amount: 0, currency: 'USD' },
        tax: { amount: 0, currency: 'USD' },
        discount: { amount: 0, currency: 'USD' },
      }),
    ).toThrow('non-negative finite');
  });

  it('normalizes currency codes consistently', () => {
    expect(
      calculateOrderTotal({
        subtotal: { amount: 10, currency: ' usd ' },
        shipping: { amount: 2, currency: 'USD' },
        tax: { amount: 0, currency: 'USD' },
        discount: { amount: 0, currency: 'USD' },
      }),
    ).toStrictEqual({ amount: 12, currency: 'USD' });
  });

  it('requires currency when calculating an empty tax total', () => {
    expect(calculateTaxTotal([], 'EUR')).toStrictEqual({
      amount: 0,
      currency: 'EUR',
    });
  });
});
