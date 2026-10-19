import 'server-only';
import { STORE_BASE_CURRENCY, roundCurrencyAmount } from './currencies';
import {
  convertCurrencyAmount,
  getConversionRate,
  getLatestUsdExchangeRates,
} from './exchange-rates';

export type ProviderCurrency = 'ARS' | 'USD';

export type PaymentConversion = {
  paymentCurrency: ProviderCurrency;
  exchangeRate: number;
  rates: Record<string, number> | null;
};

/**
 * Get one cached reference-rate snapshot per checkout. If the store's base
 * currency already matches the provider's currency, avoid an external request.
 */
export async function loadPaymentConversion(
  paymentCurrency: ProviderCurrency,
): Promise<PaymentConversion> {
  if (STORE_BASE_CURRENCY === paymentCurrency) {
    return { paymentCurrency, exchangeRate: 1, rates: null };
  }

  const quote = await getLatestUsdExchangeRates();

  return {
    paymentCurrency,
    exchangeRate: getConversionRate(STORE_BASE_CURRENCY, paymentCurrency, quote.rates),
    rates: quote.rates,
  };
}

/** Convert an amount in the store's base currency using this checkout's quote. */
export function amountInPaymentCurrency(amount: number, conversion: PaymentConversion): number {
  return amountAtExchangeRate(amount, conversion.paymentCurrency, conversion.exchangeRate);
}

/** Apply the exact exchange-rate multiplier saved with the order. */
export function amountAtExchangeRate(
  amount: number,
  paymentCurrency: ProviderCurrency,
  exchangeRate: number,
): number {
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isFinite(exchangeRate) ||
    exchangeRate <= 0
  ) {
    throw new Error('Invalid amount or saved exchange rate.');
  }

  return roundCurrencyAmount(amount * exchangeRate, paymentCurrency);
}
