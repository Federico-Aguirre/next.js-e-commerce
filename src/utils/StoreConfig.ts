/**
 * Provider-neutral configuration shared by e-commerce features.
 *
 * Adapt these values for each project without coupling the storefront to a
 * payment provider, CMS, catalog service, or brand-specific implementation.
 */
export const StoreConfig = {
  name: 'Nova Store',
  currency: 'USD',
  locale: 'en-US',
  currencyDisplay: 'symbol' as const,
} as const;

export type StoreConfig = typeof StoreConfig;

type FormatPriceOptions = {
  currency?: string;
  locale?: string;
  currencyDisplay?: Intl.NumberFormatOptions['currencyDisplay'];
};

/** Formats a monetary amount for localized storefront presentation. */
export function formatStorePrice(
  amount: number,
  options: FormatPriceOptions = {},
) {
  const currency = options.currency ?? StoreConfig.currency;
  const locale = options.locale ?? StoreConfig.locale;
  const currencyDisplay =
    options.currencyDisplay ?? StoreConfig.currencyDisplay;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay,
  }).format(amount);
}
