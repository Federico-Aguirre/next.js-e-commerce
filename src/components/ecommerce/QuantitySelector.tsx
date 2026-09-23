'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

type QuantitySelectorProps = {
  max?: number;
  value?: number;
  onChange?: (value: number) => void;
  stockLabel?: string;
};

export function QuantitySelector({
  max = 99,
  value,
  onChange,
  stockLabel,
}: QuantitySelectorProps) {
  const t = useTranslations('Storefront.product');
  const [internalQuantity, setInternalQuantity] = useState(1);
  const quantity = value ?? internalQuantity;
  const updateQuantity = (nextQuantity: number) => {
    if (value === undefined) {
      setInternalQuantity(nextQuantity);
    }
    onChange?.(nextQuantity);
  };

  return (
    <div className="space-y-2">
      <div className="inline-flex items-center rounded-lg border border-border p-1">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={t('decreaseQuantity')}
          disabled={quantity <= 1}
          onClick={() => {
            updateQuantity(Math.max(1, quantity - 1));
          }}
        >
          <Minus className="size-4" aria-hidden="true" />
        </Button>
        <input
          type="number"
          min={1}
          max={max}
          value={quantity}
          aria-label={t('quantity')}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            updateQuantity(
              Number.isFinite(parsed)
                ? Math.min(max, Math.max(1, Math.floor(parsed)))
                : 1,
            );
          }}
          className="h-9 w-14 appearance-none bg-transparent px-1 text-center text-sm font-medium outline-none"
        />
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={t('increaseQuantity')}
          disabled={quantity >= max}
          onClick={() => {
            updateQuantity(Math.min(max, quantity + 1));
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {stockLabel && (
        <p className="text-xs text-muted-foreground">{stockLabel}</p>
      )}
    </div>
  );
}
