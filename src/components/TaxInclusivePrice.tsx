'use client';

import { useLocale } from 'next-intl';
import { CurrencyPrice } from '@/components/CurrencyPrice';
import { STORE_BASE_CURRENCY } from '@/lib/currency/currencies';
import { calculateTaxBreakdown } from '@/lib/tax/tax-calculation';
import type { TaxProfile } from '@/lib/tax/types';
import { useCurrency } from '@/providers/CurrencyProvider';

type TaxInclusivePriceProps = {
  /** Catalogue amount before the applicable tax. */
  amount: number;
  fromCurrency?: string;
  locale?: string;
  className?: string;
  compact?: boolean;
  /** Allows basket summaries to use their item-by-item rounded total. */
  grossAmountOverride?: number;
  taxProfileOverride?: TaxProfile | null;
};

/**
 * In Argentina, display the final ARS price and the legally required net-price legend.
 * Outside Argentina, display the pre-tax catalog price converted to USD and label it clearly.
 */
export function TaxInclusivePrice({
  amount,
  fromCurrency = STORE_BASE_CURRENCY,
  locale,
  className,
  compact = true,
  grossAmountOverride,
  taxProfileOverride,
}: TaxInclusivePriceProps) {
  const { currency, taxProfile: contextTaxProfile } = useCurrency();
  const activeLocale = useLocale();
  const numberLocale = locale ?? (activeLocale === 'es' ? 'es-AR' : 'en-US');
  const taxProfile = taxProfileOverride === undefined ? contextTaxProfile : taxProfileOverride;
  const isArgentina = taxProfile ? taxProfile.countryCode === 'AR' : currency === 'ARS';
  const targetCurrency = isArgentina ? 'ARS' : 'USD';
  const breakdown = calculateTaxBreakdown(
    amount,
    taxProfile?.rate,
    fromCurrency,
    taxProfile?.calculationMethod,
  );
  const displayAmount = isArgentina ? (grossAmountOverride ?? breakdown.total) : amount;
  const textLocale = activeLocale.startsWith('es') ? 'es' : 'en';
  const smallText = compact ? 'text-[10px] leading-4' : 'text-xs leading-5';

  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-0.5">
      <CurrencyPrice
        amount={displayAmount}
        fromCurrency={fromCurrency}
        toCurrency={targetCurrency}
        locale={isArgentina ? 'es-AR' : numberLocale}
        approximate={targetCurrency !== fromCurrency}
        className={className}
      />

      {isArgentina ? (
        <p
          className={`${smallText} block w-full min-w-0 break-words whitespace-normal text-muted-foreground`}
        >
          <span>PRECIO SIN IMPUESTOS NACIONALES: </span>
          <CurrencyPrice
            amount={amount}
            fromCurrency={fromCurrency}
            toCurrency="ARS"
            locale="es-AR"
            approximate={false}
          />
        </p>
      ) : (
        <p
          className={`${smallText} block w-full min-w-0 break-words whitespace-normal text-muted-foreground`}
        >
          {textLocale === 'es' ? 'Precio base sin impuestos' : 'Base price before tax'}
        </p>
      )}
    </div>
  );
}
