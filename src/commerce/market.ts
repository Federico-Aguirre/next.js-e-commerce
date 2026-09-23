export type CurrencyDefinition = {
  code: string;
  fractionDigits: number;
};

export type Market = {
  id: string;
  code: string;
  name: string;
  defaultCurrency: string;
  currencies: readonly CurrencyDefinition[];
  countries: readonly string[];
};

export const resolveMarketCurrency = (
  market: Market,
  currency: string,
): CurrencyDefinition => {
  const normalized = currency.trim().toUpperCase();
  const match = market.currencies.find(
    (candidate) => candidate.code.toUpperCase() === normalized,
  );

  if (!match) {
    throw new Error(
      `Currency ${normalized} is not supported by market ${market.code}`,
    );
  }

  return match;
};

export type MarketRepository = {
  getMarket: (marketId: string) => Promise<Market | null>;
  listMarkets: () => Promise<readonly Market[]>;
};
