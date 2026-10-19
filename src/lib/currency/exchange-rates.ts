import 'server-only';
import { roundCurrencyAmount } from './currencies';

const EXCHANGE_RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const RATE_CACHE_SECONDS = 24 * 60 * 60;

export type UsdExchangeRates = {
  baseCode: 'USD';
  rates: Record<string, number>;
  updatedAt: string;
  nextUpdateAt: string | null;
};

type ExchangeRateApiResponse = {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_utc?: string;
  time_next_update_utc?: string;
};

export async function getLatestUsdExchangeRates(): Promise<UsdExchangeRates> {
  const response = await fetch(EXCHANGE_RATE_URL, {
    next: { revalidate: RATE_CACHE_SECONDS },
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Exchange-rate service returned HTTP ${response.status}.`);
  }

  const data = (await response.json()) as ExchangeRateApiResponse;
  if (data.result !== 'success' || data.base_code !== 'USD' || !data.rates) {
    throw new Error('Exchange-rate service returned an invalid response.');
  }

  return {
    baseCode: 'USD',
    rates: data.rates,
    updatedAt: data.time_last_update_utc ?? new Date().toISOString(),
    nextUpdateAt: data.time_next_update_utc ?? null,
  };
}

/** Rates from ExchangeRate-API are quoted as target-currency units per USD. */
export function getConversionRate(
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  const fromRate = rates[fromCurrency.toUpperCase()];
  const toRate = rates[toCurrency.toUpperCase()];

  if (
    !Number.isFinite(fromRate) ||
    !Number.isFinite(toRate) ||
    !fromRate ||
    !toRate ||
    fromRate <= 0 ||
    toRate <= 0
  ) {
    throw new Error(`No valid exchange rate is available for ${fromCurrency} → ${toCurrency}.`);
  }

  return toRate / fromRate;
}

export function convertCurrencyAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('The monetary amount must be a non-negative finite number.');
  }

  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return roundCurrencyAmount(amount, toCurrency);
  }

  return roundCurrencyAmount(
    amount * getConversionRate(fromCurrency, toCurrency, rates),
    toCurrency,
  );
}
