export const CURRENCIES = [
  {
    code: 'ARS',
    nameEs: 'Peso argentino',
    nameEn: 'Argentine peso',
    fractionDigits: 2,
  },
  {
    code: 'USD',
    nameEs: 'Dólar estadounidense',
    nameEn: 'US dollar',
    fractionDigits: 2,
  },
] as const;

export type SupportedCurrency = (typeof CURRENCIES)[number]['code'];

export const SUPPORTED_CURRENCY_CODES = CURRENCIES.map(({ code }) => code) as SupportedCurrency[];

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return (
    typeof value === 'string' &&
    SUPPORTED_CURRENCY_CODES.includes(value.toUpperCase() as SupportedCurrency)
  );
}

/** Catalog prices are stored as pre-tax Argentine pesos after the one-time conversion migration. */
export function resolveBaseCurrency(value: string | undefined): SupportedCurrency {
  const normalized = value?.trim().toUpperCase();
  return isSupportedCurrency(normalized) ? normalized : 'ARS';
}

export const STORE_BASE_CURRENCY = resolveBaseCurrency(process.env.NEXT_PUBLIC_STORE_BASE_CURRENCY);

/** Argentina uses ARS; every other or unknown country uses USD. */
export function resolveDisplayCurrency(countryCode: string | null | undefined): SupportedCurrency {
  return countryCode?.trim().toUpperCase() === 'AR' ? 'ARS' : 'USD';
}

export function currencyFractionDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

export function roundCurrencyAmount(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) {
    throw new Error('The monetary amount must be finite.');
  }

  const factor = 10 ** currencyFractionDigits(currency);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}
