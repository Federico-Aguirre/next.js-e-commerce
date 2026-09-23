import type { Money } from '@/commerce/contracts';
import { formatStorePrice } from '@/utils/StoreConfig';

type PriceProps = {
  money: Money;
  locale: string;
  compareAt?: Money;
  className?: string;
};

export function Price({ money, locale, compareAt, className }: PriceProps) {
  const formatted = formatStorePrice(money.amount, {
    currency: money.currency,
    locale,
  });

  return (
    <span className={className}>
      <span className="font-semibold tracking-tight">{formatted}</span>
      {compareAt && compareAt.amount > money.amount ? (
        <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
          {formatStorePrice(compareAt.amount, {
            currency: compareAt.currency,
            locale,
          })}
        </span>
      ) : null}
    </span>
  );
}
