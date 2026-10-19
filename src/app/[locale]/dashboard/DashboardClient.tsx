'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { Link } from '@/lib/I18nRouting';
import { StoreConfig } from '@/utils/StoreConfig';
import { updateCatalog } from './actions';
import CatalogRow from './CatalogRow';
import OrderRow from './OrderRow';
import PaymentConnectionsCard from './PaymentConnectionsCard';
import SubscriptionCard from './SubscriptionCard';
import type { DashboardData } from './types';

function money(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: StoreConfig.currency,
  }).format(amount);
}

type CatalogSort =
  | 'name-asc'
  | 'name-desc'
  | 'stock-asc'
  | 'stock-desc'
  | 'price-asc'
  | 'price-desc';

type CatalogEdit = {
  price: string;
  stock: string;
  isActive: boolean;
};

function initialCatalogEdits(data: DashboardData) {
  return Object.fromEntries(
    data.catalogControls.map((item) => [
      item.skuId,
      {
        price: String(item.productPrice),
        stock: String(item.stock),
        isActive: item.isActive,
      } satisfies CatalogEdit,
    ]),
  ) as Record<string, CatalogEdit>;
}

function sortCatalogItems<T extends DashboardData['catalogControls'][number]>(
  items: T[],
  sortBy: CatalogSort,
  locale: string,
) {
  return [...items].sort((a, b) => {
    if (sortBy === 'stock-asc') return a.stock - b.stock;
    if (sortBy === 'stock-desc') return b.stock - a.stock;
    if (sortBy === 'price-asc') return a.productPrice - b.productPrice;
    if (sortBy === 'price-desc') return b.productPrice - a.productPrice;

    const byName = a.productName.localeCompare(b.productName, locale, { sensitivity: 'base' });
    const orderedName = sortBy === 'name-desc' ? -byName : byName;
    return orderedName !== 0 ? orderedName : a.sku - b.sku;
  });
}

export default function DashboardClient({
  data,
  canManagePaymentConnections,
}: {
  data: DashboardData;
  canManagePaymentConnections: boolean;
}) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const [catalogSort, setCatalogSort] = useState<CatalogSort>('name-asc');
  const [catalogEdits, setCatalogEdits] = useState(() => initialCatalogEdits(data));
  const [alertThreshold, setAlertThreshold] = useState(String(data.inventoryAlert.threshold));
  const [alertsEnabled, setAlertsEnabled] = useState(data.inventoryAlert.enabled);
  const [catalogFeedback, setCatalogFeedback] = useState<string | null>(null);
  const [catalogPending, startCatalogTransition] = useTransition();
  const sortedCatalogControls = useMemo(
    () => sortCatalogItems(data.catalogControls, catalogSort, locale),
    [data.catalogControls, catalogSort, locale],
  );
  const deviceTotal = data.devices.mobile + data.devices.desktop;
  const mobilePercent = deviceTotal > 0 ? (data.devices.mobile / deviceTotal) * 100 : 0;
  const desktopPercent = deviceTotal > 0 ? (data.devices.desktop / deviceTotal) * 100 : 0;

  const cards = [
    [t('salesTotal'), money(data.salesTotal, locale)],
    [t('visits'), data.visits.toLocaleString(locale)],
    [t('conversionRate'), `${data.conversionRate.toFixed(2)}%`],
    [t('averageTicket'), money(data.averageTicket, locale)],
    [t('abandonedCarts'), data.abandonedCarts.toLocaleString(locale)],
    [t('yourCommissionThisMonth'), money(data.commissionAmount, locale)],
  ] as const;

  function updateProductFields(
    productId: number,
    patch: Partial<Pick<CatalogEdit, 'price' | 'isActive'>>,
  ) {
    setCatalogEdits((current) => {
      const next = { ...current };
      for (const item of data.catalogControls) {
        if (item.productId !== productId) continue;
        next[item.skuId] = { ...next[item.skuId]!, ...patch };
      }
      return next;
    });
  }

  function updateSkuStock(skuId: string, stock: string) {
    setCatalogEdits((current) => ({
      ...current,
      [skuId]: { ...current[skuId]!, stock },
    }));
  }

  function saveCatalog() {
    const threshold = Number(alertThreshold);
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100_000) {
      setCatalogFeedback(t('stockAlertInvalidThreshold'));
      return;
    }

    const updates = data.catalogControls.map((item) => {
      const edit = catalogEdits[item.skuId]!;
      return {
        productId: item.productId,
        skuId: item.skuId,
        price: Number(edit.price),
        stock: Number(edit.stock),
        isActive: edit.isActive,
      };
    });

    const hasInvalidRow = updates.some(
      (item) =>
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        !Number.isInteger(item.stock) ||
        item.stock < 0 ||
        item.stock > 100_000,
    );
    if (hasInvalidRow) {
      setCatalogFeedback(t('catalogInvalidValues'));
      return;
    }

    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('threshold', String(threshold));
    formData.set('alertsEnabled', String(alertsEnabled));
    formData.set('updates', JSON.stringify(updates));

    setCatalogFeedback(null);
    startCatalogTransition(async () => {
      const result = await updateCatalog(formData);
      if (!result.success) {
        setCatalogFeedback(t('catalogSaveError'));
        return;
      }

      if (alertsEnabled && !result.configured) {
        setCatalogFeedback(t('stockAlertTelegramMissing'));
      } else if (result.sent > 0) {
        setCatalogFeedback(t('catalogSavedWithAlerts', { count: result.sent }));
      } else {
        setCatalogFeedback(t('catalogSaved'));
      }
    });
  }

  return (
    <div className="space-y-8 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Link
        href="/dashboard/solicitudes-legales"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition hover:bg-muted/40"
      >
        <span className="font-semibold">
          {locale === 'es' ? 'Solicitudes de arrepentimiento' : 'Withdrawal requests'}
        </span>
        <span className="text-sm text-muted-foreground">
          {locale === 'es' ? 'Revisar solicitudes de compradores →' : 'Review customer requests →'}
        </span>
      </Link>

      <section className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('moneyStatsNote')}</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(([label, value]) => (
            <article key={label} className="rounded-2xl border p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border p-5">
          <h2 className="text-lg font-semibold">{t('topProducts')}</h2>
          <div className="mt-4 space-y-3">
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              data.topProducts.map((product, index) => (
                <div
                  key={`${product.title}-${index}`}
                  className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {index + 1}. {product.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {product.quantity} {t('units')}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">{money(product.revenue, locale)}</p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border p-5">
          <h2 className="text-lg font-semibold">{t('devices')}</h2>
          {deviceTotal === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{t('noVisits')}</p>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex justify-between text-sm">
                  <span>{t('mobile')}</span>
                  <span>
                    {mobilePercent.toFixed(1)}% · {data.devices.mobile}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${mobilePercent}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>{t('desktop')}</span>
                  <span>
                    {desktopPercent.toFixed(1)}% · {data.devices.desktop}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary/60"
                    style={{ width: `${desktopPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="rounded-2xl border p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t('catalogControl')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('catalogControlSubtitle')}</p>
          </div>
          <label className="grid gap-1 text-sm">
            <span>{t('sortBy')}</span>
            <select
              className="rounded-md border bg-background px-3 py-2"
              value={catalogSort}
              onChange={(event) => setCatalogSort(event.target.value as CatalogSort)}
            >
              <option value="name-asc">{t('sortNameAsc')}</option>
              <option value="name-desc">{t('sortNameDesc')}</option>
              <option value="stock-asc">{t('sortStockAsc')}</option>
              <option value="stock-desc">{t('sortStockDesc')}</option>
              <option value="price-asc">{t('sortPriceAsc')}</option>
              <option value="price-desc">{t('sortPriceDesc')}</option>
            </select>
          </label>
        </div>

        <div className="mt-5 rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{t('stockAlertThreshold')}</span>
              <input
                className="w-36 rounded-md border bg-background px-3 py-2"
                type="number"
                min="0"
                max="100000"
                step="1"
                inputMode="numeric"
                value={alertThreshold}
                onChange={(event) => setAlertThreshold(event.target.value)}
              />
            </label>

            <button
              type="button"
              aria-pressed={alertsEnabled}
              className={`rounded-md border px-4 py-2 text-sm font-medium ${
                alertsEnabled ? 'border-sky-300 bg-sky-50 text-sky-800' : 'bg-background'
              }`}
              onClick={() => setAlertsEnabled((current) => !current)}
            >
              📱 {alertsEnabled ? t('stockAlertOn') : t('stockAlertOff')}
            </button>

            <p className="max-w-xl text-xs leading-5 text-muted-foreground">
              {t('stockAlertExplanation')}
              {!data.inventoryAlert.telegramConfigured && ` ${t('stockAlertTelegramMissing')}`}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {sortedCatalogControls.map((item) => {
            const edit = catalogEdits[item.skuId]!;
            const threshold = Number(alertThreshold);
            const stock = Number(edit.stock);
            const lowStock =
              Number.isInteger(threshold) && Number.isInteger(stock) && stock <= threshold;

            return (
              <CatalogRow
                key={`${item.productId}-${item.skuId}`}
                item={item}
                value={edit}
                lowStock={lowStock}
                onPriceChange={(price) => updateProductFields(item.productId, { price })}
                onStockChange={(value) => updateSkuStock(item.skuId, value)}
                onActiveChange={(isActive) => updateProductFields(item.productId, { isActive })}
              />
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">{catalogFeedback ?? t('catalogSaveHint')}</p>
          <button
            type="button"
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            disabled={catalogPending}
            onClick={saveCatalog}
          >
            {catalogPending ? t('saving') : t('saveAllCatalog')}
          </button>
        </div>
      </section>

      {canManagePaymentConnections && (
        <PaymentConnectionsCard connections={data.paymentConnections} />
      )}

      <section className="rounded-2xl border p-5">
        <div>
          <h2 className="text-lg font-semibold">{t('recentOrders')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('recentOrdersSubtitle')}</p>
        </div>
        <div className="mt-4 space-y-3">
          {data.recentOrders.map((order) => (
            <OrderRow key={`${order.id}-${order.updatedAt}`} order={order} />
          ))}
        </div>
      </section>

      <SubscriptionCard
        commissionPercent={data.commissionPercent}
        monthlyCompletedRevenue={data.monthlyCompletedRevenue}
        commissionAmount={data.commissionAmount}
      />
    </div>
  );
}
