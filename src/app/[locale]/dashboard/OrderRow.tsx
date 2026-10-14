'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { formatOrderNumber, paymentProviderLabel } from '@/lib/orders/format';
import type { ShippingQuote } from '@/lib/shipping/types';
import { StoreConfig } from '@/utils/StoreConfig';
import { createShipment, quoteShipment, refreshShipment, updateOrder } from './actions';
import type { DashboardOrder, FulfillmentStatus } from './types';

const transitions: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  PENDING: ['PENDING', 'PREPARING', 'CANCELLED'],
  PREPARING: ['PREPARING', 'SHIPPED', 'CANCELLED'],
  SHIPPED: ['SHIPPED', 'DELIVERED'],
  DELIVERED: ['DELIVERED'],
  CANCELLED: ['CANCELLED'],
};

function isFulfillmentStatus(value: string): value is FulfillmentStatus {
  return Object.keys(transitions).includes(value);
}

function money(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: StoreConfig.currency,
  }).format(amount);
}

function shippingMoney(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

function dateLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function paymentStatusLabel(status: string, t: ReturnType<typeof useTranslations<'Dashboard'>>) {
  switch (status) {
    case 'PAID':
      return t('paymentPaid');
    case 'PENDING':
      return t('paymentPending');
    case 'PAYMENT_FAILED':
    case 'FAILED':
      return t('paymentFailed');
    case 'REFUND_PENDING':
      return t('paymentRefundPending');
    case 'REFUNDED':
      return t('paymentRefunded');
    default:
      return status;
  }
}

function deliveryHours(value: string | null) {
  if (!value) return '';
  return String(Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 3_600_000)));
}

export default function OrderRow({ order }: { order: DashboardOrder }) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState(order.fulfillmentStatus);
  const [tracking, setTracking] = useState(order.trackingCode ?? '');
  const [hours, setHours] = useState(deliveryHours(order.estimatedDeliveryAt));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [shippingPending, startShippingTransition] = useTransition();
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [shippingMessage, setShippingMessage] = useState<string | null>(null);

  const deliveryName = [order.delivery.firstName, order.delivery.lastName]
    .filter(Boolean)
    .join(' ');
  const deliveryStreet = [order.delivery.street, order.delivery.number].filter(Boolean).join(' ');
  const deliveryLocality = [order.delivery.postalCode, order.delivery.city]
    .filter(Boolean)
    .join(' · ');
  const hasDeliveryData = Boolean(
    deliveryName || deliveryStreet || order.delivery.phone || order.delivery.email,
  );

  function save() {
    const formData = new FormData();
    formData.set('orderId', order.id);
    formData.set('fulfillmentStatus', status);
    formData.set('trackingCode', tracking);
    formData.set('estimatedDeliveryHours', hours);
    formData.set('locale', locale);

    setSaved(false);
    startTransition(async () => {
      const result = await updateOrder(formData);
      if (!result.success) return;
      setSaved(true);
      router.refresh();
    });
  }

  function quoteShipping() {
    const formData = new FormData();
    formData.set('orderId', order.id);
    setShippingMessage(null);
    startShippingTransition(async () => {
      const result = await quoteShipment(formData);
      if (!result.success) {
        setShippingMessage(result.error);
        return;
      }
      setShippingQuotes(result.quotes);
      setSelectedQuoteId(result.quotes[0]?.id ?? '');
      setShippingMessage(
        result.quotes.length > 0
          ? t('shippingQuotesFound', { count: result.quotes.length })
          : t('shippingNoQuotes'),
      );
    });
  }

  function createShipping() {
    const quote = shippingQuotes.find((item) => item.id === selectedQuoteId);
    if (!quote) return;
    const formData = new FormData();
    formData.set('orderId', order.id);
    formData.set('locale', locale);
    formData.set('quote', JSON.stringify(quote));
    setShippingMessage(null);
    startShippingTransition(async () => {
      const result = await createShipment(formData);
      if (!result.success) {
        setShippingMessage(result.error);
        return;
      }
      setShippingMessage(t('shippingCreated'));
      setShippingQuotes([]);
      setSelectedQuoteId('');
      router.refresh();
    });
  }

  function refreshShipping() {
    const formData = new FormData();
    formData.set('orderId', order.id);
    formData.set('locale', locale);
    setShippingMessage(null);
    startShippingTransition(async () => {
      const result = await refreshShipment(formData);
      if (!result.success) {
        setShippingMessage(result.error);
        return;
      }
      setShippingMessage(t('shippingRefreshed'));
      router.refresh();
    });
  }

  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {t('order')} #{formatOrderNumber(order.orderNumber)}
          </p>
          <p className="text-sm text-muted-foreground">
            {order.customer ?? '—'} · {dateLabel(order.createdAt, locale)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('paymentMethod')}: {paymentProviderLabel(order.paymentProvider)} ·{' '}
            {t('paymentStatus')}: {paymentStatusLabel(order.paymentStatus, t)}
          </p>
        </div>
        <p className="font-semibold">{money(order.total, locale)}</p>
      </div>

      <div className="mt-4 rounded-lg border bg-muted/30 p-3">
        <p className="text-sm font-semibold">{t('deliveryAddress')}</p>

        {hasDeliveryData ? (
          <div className="mt-2 grid gap-x-6 gap-y-1 text-sm text-muted-foreground md:grid-cols-2">
            <p>
              <span className="font-medium text-foreground">{t('deliveryRecipient')}:</span>{' '}
              {deliveryName || '—'}
            </p>
            <p>
              <span className="font-medium text-foreground">{t('deliveryPhone')}:</span>{' '}
              {order.delivery.phone || '—'}
            </p>
            <p>
              <span className="font-medium text-foreground">{t('deliveryEmail')}:</span>{' '}
              {order.delivery.email || '—'}
            </p>
            <p>
              <span className="font-medium text-foreground">{t('deliveryDni')}:</span>{' '}
              {order.delivery.dni || '—'}
            </p>
            <div className="md:col-span-2">
              <span className="font-medium text-foreground">{t('deliveryAddress')}:</span>{' '}
              {[
                deliveryStreet,
                order.delivery.apartment,
                deliveryLocality,
                order.delivery.province,
                order.delivery.country,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t('deliveryNoData')}</p>
        )}
      </div>

      <div className="mt-4 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{t('shippingIntegration')}</p>
            <p className="text-xs text-muted-foreground">
              {order.shipping.provider
                ? `${order.shipping.provider} · ${order.shipping.mode ?? 'sandbox'}`
                : t('shippingAutomaticProvider')}
            </p>
          </div>
          {order.paymentStatus !== 'PAID' && (
            <span className="text-xs text-muted-foreground">{t('shippingRequiresPaid')}</span>
          )}
        </div>

        {order.shipping.externalId ? (
          <div className="mt-3 space-y-2 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <p>
                <span className="font-medium">{t('shippingCarrier')}:</span>{' '}
                {order.shipping.carrier ?? '—'}
              </p>
              <p>
                <span className="font-medium">{t('shippingService')}:</span>{' '}
                {order.shipping.service ?? '—'}
              </p>
              <p>
                <span className="font-medium">{t('shippingProviderStatus')}:</span>{' '}
                {order.shipping.status ?? '—'}
              </p>
              <p>
                <span className="font-medium">{t('shippingRate')}:</span>{' '}
                {order.shipping.rate !== null && order.shipping.currency
                  ? shippingMoney(order.shipping.rate, order.shipping.currency, locale)
                  : '—'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {order.shipping.trackingUrl && (
                <a
                  href={order.shipping.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {t('shippingOpenTracking')}
                </a>
              )}
              {order.shipping.labelUrl && (
                <a
                  href={order.shipping.labelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {t('shippingOpenLabel')}
                </a>
              )}
            </div>
            {order.shipping.provider !== 'LOCAL' && (
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                disabled={shippingPending}
                onClick={refreshShipping}
              >
                {shippingPending ? '...' : t('shippingRefresh')}
              </button>
            )}
          </div>
        ) : order.paymentStatus === 'PAID' ? (
          <div className="mt-3 space-y-3">
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              disabled={shippingPending}
              onClick={quoteShipping}
            >
              {shippingPending ? '...' : t('shippingQuote')}
            </button>

            {shippingQuotes.length > 0 && (
              <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                <label className="grid gap-1 text-sm">
                  <span>{t('shippingChooseRate')}</span>
                  <select
                    className="rounded-md border bg-background px-3 py-2"
                    value={selectedQuoteId}
                    onChange={(event) => setSelectedQuoteId(event.target.value)}
                  >
                    {shippingQuotes.map((quote) => (
                      <option key={quote.id} value={quote.id}>
                        {quote.carrier} · {quote.service} ·{' '}
                        {shippingMoney(quote.amount, quote.currency, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                  disabled={shippingPending || !selectedQuoteId}
                  onClick={createShipping}
                >
                  {shippingPending ? '...' : t('shippingCreateSandbox')}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {(shippingMessage || order.shipping.error) && (
          <p className="mt-2 text-xs text-muted-foreground">
            {shippingMessage ?? order.shipping.error}
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span>{t('fulfillment')}</span>
          <select
            className="rounded-md border bg-background px-3 py-2"
            value={status}
            onChange={(event) => {
              const value = event.target.value;
              if (isFulfillmentStatus(value)) setStatus(value);
            }}
          >
            {transitions[status].map((value) => (
              <option key={value} value={value}>
                {value === 'PENDING' && t('status.pending')}
                {value === 'PREPARING' && t('status.preparing')}
                {value === 'SHIPPED' && t('status.shipped')}
                {value === 'DELIVERED' && t('status.delivered')}
                {value === 'CANCELLED' && t('status.cancelled')}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>{t('estimatedDelivery')}</span>
          <div className="flex items-center gap-2">
            <input
              className="min-w-0 rounded-md border bg-background px-3 py-2"
              type="number"
              min="0"
              max="720"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
            <span className="text-muted-foreground">{t('hours')}</span>
          </div>
        </label>

        <label className="grid gap-1 text-sm">
          <span>{t('tracking')}</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={tracking}
            maxLength={100}
            onChange={(event) => setTracking(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="self-end rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          disabled={pending}
          onClick={save}
        >
          {pending ? '...' : saved ? t('saved') : t('save')}
        </button>
      </div>
    </article>
  );
}
