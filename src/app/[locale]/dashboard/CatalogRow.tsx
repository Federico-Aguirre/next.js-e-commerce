'use client';

import { useTranslations } from 'next-intl';
import type { DashboardData } from './types';

type CatalogItem = DashboardData['catalogControls'][number];

type CatalogEdit = {
  price: string;
  stock: string;
  isActive: boolean;
};

type Props = {
  item: CatalogItem;
  value: CatalogEdit;
  lowStock: boolean;
  onPriceChange: (value: string) => void;
  onStockChange: (value: string) => void;
  onActiveChange: (value: boolean) => void;
};

export default function CatalogRow({
  item,
  value,
  lowStock,
  onPriceChange,
  onStockChange,
  onActiveChange,
}: Props) {
  const t = useTranslations('Dashboard');

  return (
    <article
      className={`rounded-xl border p-4 ${lowStock ? 'border-amber-300 bg-amber-50/50' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{item.productName}</p>
            {lowStock && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {t('lowStockBadge')}
              </span>
            )}
            {lowStock && item.lowStockAlertSent && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                {t('stockAlertSent')}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('sku')} {item.sku} · {item.colorName} · {item.size}
          </p>
        </div>
        <span className="text-sm font-medium">{value.isActive ? t('active') : t('paused')}</span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span>{t('price')}</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            type="number"
            min="0"
            step="0.01"
            value={value.price}
            onChange={(event) => onPriceChange(event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>{t('stock')}</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            type="number"
            min="0"
            max="100000"
            value={value.stock}
            onChange={(event) => onStockChange(event.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={value.isActive}
            onChange={(event) => onActiveChange(event.target.checked)}
          />
          <span>{value.isActive ? t('active') : t('paused')}</span>
        </label>
      </div>
    </article>
  );
}
