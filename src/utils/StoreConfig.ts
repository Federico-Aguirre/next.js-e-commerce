import { STORE_BASE_CURRENCY } from '@/lib/currency/currencies';

/**
 * Provider-neutral store settings.
 * Catalog prices are fixed in ARS before tax; new order totals include the tax snapshot.
 * Visitors abroad see a reference conversion to USD; payment gateways retain their own currencies.
 */
export const StoreConfig = {
  name: 'Nova Store',
  currency: STORE_BASE_CURRENCY,
  locale: 'en-US',
  currencyDisplay: 'code' as const,
} as const;

export type StoreConfig = typeof StoreConfig;

type FormatPriceOptions = {
  currency?: string;
  locale?: string;
  currencyDisplay?: Intl.NumberFormatOptions['currencyDisplay'];
};

/** Formats an amount while keeping its currency explicit. */
export function formatStorePrice(amount: number, options: FormatPriceOptions = {}) {
  const currency = options.currency ?? StoreConfig.currency;
  const locale = options.locale ?? StoreConfig.locale;
  const currencyDisplay = options.currencyDisplay ?? StoreConfig.currencyDisplay;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay,
  }).format(amount);
}
