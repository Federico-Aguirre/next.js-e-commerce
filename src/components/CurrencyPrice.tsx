'use client';

import { STORE_BASE_CURRENCY } from '@/lib/currency/currencies';
import { useCurrency } from '@/providers/CurrencyProvider';

type CurrencyPriceProps = {
  amount: number;
  fromCurrency?: string;
  toCurrency?: string;
  locale?: string;
  className?: string;
  approximate?: boolean;
};

export function CurrencyPrice({
  amount,
  fromCurrency = STORE_BASE_CURRENCY,
  toCurrency,
  locale = 'es-AR',
  className,
  approximate = true,
}: CurrencyPriceProps) {
  const { currency, convertAmount, ratesReady } = useCurrency();
  const targetCurrency = toCurrency ?? currency;
  const convertedAmount = convertAmount(amount, fromCurrency, targetCurrency);
  const rateUnavailable = convertedAmount === null;
  const isApproximate = approximate && fromCurrency.toUpperCase() !== targetCurrency.toUpperCase();

  if (rateUnavailable && !ratesReady) {
    return (
      <span className={className}>
        {locale.startsWith('es') ? 'Cargando precio…' : 'Loading price…'}
      </span>
    );
  }

  if (rateUnavailable) {
    return (
      <span
        className={className}
        title={
          locale.startsWith('es')
            ? 'Cotización temporalmente no disponible.'
            : 'Exchange rate temporarily unavailable.'
        }
      >
        {locale.startsWith('es') ? 'Cotización no disponible' : 'Rate unavailable'}
      </span>
    );
  }

  return (
    <span
      className={className}
      title={
        isApproximate
          ? locale.startsWith('es')
            ? 'Conversión estimada; el importe final depende de la moneda de cobro de la pasarela.'
            : 'Estimated conversion; the final amount depends on the payment provider’s charge currency.'
          : undefined
      }
      aria-label={
        isApproximate
          ? locale.startsWith('es')
            ? 'Precio aproximado'
            : 'Approximate price'
          : undefined
      }
    >
      {isApproximate ? '≈ ' : ''}
      {new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: targetCurrency,
        currencyDisplay: 'code',
      }).format(convertedAmount)}
    </span>
  );
}
