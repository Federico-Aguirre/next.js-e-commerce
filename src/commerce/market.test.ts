import { describe, expect, it } from 'vitest';

import type { Market } from './market';
import { resolveMarketCurrency } from './market';

const market: Market = {
  id: 'us',
  code: 'US',
  name: 'United States',
  defaultCurrency: 'USD',
  currencies: [
    { code: 'USD', fractionDigits: 2 },
    { code: 'EUR', fractionDigits: 2 },
  ],
  countries: ['US'],
};

describe('market currency resolution', () => {
  it('resolves a supported currency case-insensitively', () => {
    expect(resolveMarketCurrency(market, ' eur ')).toStrictEqual({
      code: 'EUR',
      fractionDigits: 2,
    });
  });

  it('rejects currencies that are not enabled for the market', () => {
    expect(() => resolveMarketCurrency(market, 'GBP')).toThrow(
      'is not supported by market',
    );
  });
});
