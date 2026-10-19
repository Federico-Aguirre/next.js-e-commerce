import type { Money } from '@/commerce/contracts';
import { TaxInclusivePrice } from '@/components/TaxInclusivePrice';

type PriceProps = {
  money: Money;
  locale: string;
  compareAt?: Money;
  className?: string;
};

export function Price({ money, locale, compareAt, className }: PriceProps) {
  return (
    <div className={className}>
      <div className="font-semibold tracking-tight">
        <TaxInclusivePrice amount={money.amount} fromCurrency={money.currency} locale={locale} />
      </div>
      {compareAt && compareAt.amount > money.amount ? (
        <div className="mt-1 text-sm font-normal text-muted-foreground line-through">
          <TaxInclusivePrice
            amount={compareAt.amount}
            fromCurrency={compareAt.currency}
            locale={locale}
          />
        </div>
      ) : null}
    </div>
  );
}
