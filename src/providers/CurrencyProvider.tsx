'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  roundCurrencyAmount,
  STORE_BASE_CURRENCY,
  type SupportedCurrency,
} from '@/lib/currency/currencies';
import type { TaxProfile } from '@/lib/tax/types';

type CurrencyContextValue = {
  currency: SupportedCurrency;
  baseCurrency: SupportedCurrency;
  rates: Record<string, number> | null;
  ratesReady: boolean;
  ratesUpdatedAt: string | null;
  taxProfile: TaxProfile | null;
  convertAmount: (amount: number, fromCurrency?: string, toCurrency?: string) => number | null;
  formatAmount: (
    amount: number,
    options?: {
      fromCurrency?: string;
      toCurrency?: string;
      locale?: string;
      currencyDisplay?: Intl.NumberFormatOptions['currencyDisplay'];
    },
  ) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

type CurrencyProviderProps = PropsWithChildren<{
  initialCurrency: SupportedCurrency;
  initialRates: Record<string, number> | null;
  initialRatesUpdatedAt: string | null;
  initialTaxProfile: TaxProfile | null;
}>;

export function CurrencyProvider({
  children,
  initialCurrency,
  initialRates,
  initialRatesUpdatedAt,
  initialTaxProfile,
}: CurrencyProviderProps) {
  const [rates, setRates] = useState<Record<string, number> | null>(initialRates);
  const [ratesReady, setRatesReady] = useState(initialRates !== null);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(initialRatesUpdatedAt);

  useEffect(() => {
    if (initialRates) {
      setRates(initialRates);
      setRatesUpdatedAt(initialRatesUpdatedAt);
      setRatesReady(true);
      return;
    }

    let active = true;

    async function loadRates() {
      try {
        const response = await fetch('/api/currency-rates', { cache: 'no-store' });
        const data = (await response.json()) as {
          rates?: Record<string, number>;
          updatedAt?: string;
        };

        if (
          !response.ok ||
          !data.rates ||
          !Number.isFinite(data.rates.USD) ||
          !Number.isFinite(data.rates.ARS) ||
          data.rates.USD <= 0 ||
          data.rates.ARS <= 0
        ) {
          throw new Error('USD/ARS reference rates are unavailable.');
        }
        if (!active) return;

        setRates({ USD: data.rates.USD, ARS: data.rates.ARS });
        setRatesUpdatedAt(data.updatedAt ?? null);
      } catch {
        if (!active) return;
        setRates(null);
        setRatesUpdatedAt(null);
      } finally {
        if (active) setRatesReady(true);
      }
    }

    void loadRates();
    return () => {
      active = false;
    };
  }, [initialRates, initialRatesUpdatedAt]);

  const convertAmount = useCallback(
    (
      amount: number,
      fromCurrency: string = STORE_BASE_CURRENCY,
      toCurrency: string = initialCurrency,
    ): number | null => {
      if (!Number.isFinite(amount) || amount < 0) return null;
      const from = fromCurrency.toUpperCase();
      const to = toCurrency.toUpperCase();

      if (from === to) return roundCurrencyAmount(amount, to);
      if (!rates) return null;

      const fromRate = rates[from];
      const toRate = rates[to];
      if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || !fromRate || !toRate) {
        return null;
      }

      return roundCurrencyAmount(amount * (toRate / fromRate), to);
    },
    [initialCurrency, rates],
  );

  const formatAmount = useCallback(
    (
      amount: number,
      options: {
        fromCurrency?: string;
        toCurrency?: string;
        locale?: string;
        currencyDisplay?: Intl.NumberFormatOptions['currencyDisplay'];
      } = {},
    ) => {
      const fromCurrency = options.fromCurrency ?? STORE_BASE_CURRENCY;
      const toCurrency = options.toCurrency ?? initialCurrency;
      const convertedAmount = convertAmount(amount, fromCurrency, toCurrency);
      const fallbackCurrency = convertedAmount === null ? fromCurrency : toCurrency;
      const formattedAmount = convertedAmount ?? amount;

      return new Intl.NumberFormat(options.locale ?? 'es-AR', {
        style: 'currency',
        currency: fallbackCurrency,
        currencyDisplay: options.currencyDisplay ?? 'code',
      }).format(formattedAmount);
    },
    [convertAmount, initialCurrency],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency: initialCurrency,
      baseCurrency: STORE_BASE_CURRENCY,
      rates,
      ratesReady,
      ratesUpdatedAt,
      taxProfile: initialTaxProfile,
      convertAmount,
      formatAmount,
    }),
    [
      initialCurrency,
      rates,
      ratesReady,
      ratesUpdatedAt,
      initialTaxProfile,
      convertAmount,
      formatAmount,
    ],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider.');
  }
  return context;
}
