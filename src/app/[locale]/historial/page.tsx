'use client';

import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/I18nRouting';
import { formatOrderNumber, paymentProviderLabel } from '@/lib/orders/format';
import { calculateTaxBreakdown } from '@/lib/tax/tax-calculation';
import { useCartStore } from '@/store/useCartStore';
import { formatStorePrice, StoreConfig } from '@/utils/StoreConfig';

interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  size?: string;
}

interface Order {
  id: string;
  orderNumber: number;
  userId: string;
  total: number;
  subtotal: number;
  shippingAmount: number;
  shippingQuoteRate: number | null;
  shippingQuoteCurrency: string | null;
  taxAmount: number;
  taxRate: number | null;
  taxCalculationMethod: string | null;
  taxCountry: string | null;
  taxName: string | null;
  currency: string;
  paymentCurrency: string;
  paymentTotal: number | null;
  paymentExchangeRate: number | null;
  status: string;
  paymentProvider: string | null;
  fulfillmentStatus: string;
  trackingCode: string | null;
  estimatedDeliveryAt: string | null;
  shippingCarrier: string | null;
  shippingService: string | null;
  shippingTrackingUrl: string | null;
  canCancel: boolean;
  refundStatus: string | null;
  deliveryFirstName: string | null;
  deliveryLastName: string | null;
  deliveryPhone: string | null;
  deliveryStreet: string | null;
  deliveryNumber: string | null;
  deliveryApartment: string | null;
  deliveryCity: string | null;
  deliveryProvince: string | null;
  deliveryPostalCode: string | null;
  deliveryCountry: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

function deliveryLines(order: Order) {
  const street = [order.deliveryStreet, order.deliveryNumber].filter(Boolean).join(' ');
  const locality = [order.deliveryPostalCode, order.deliveryCity].filter(Boolean).join(' · ');

  return [street, order.deliveryApartment, locality, order.deliveryProvince, order.deliveryCountry]
    .filter(Boolean)
    .map(String);
}

export default function HistorialPage() {
  const t = useTranslations('History');
  const locale = useLocale();
  const numberLocale = locale === 'es' ? 'es-AR' : 'en-US';
  const [compras, setCompras] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelFeedback, setCancelFeedback] = useState<{
    orderId: string;
    error: boolean;
    text: string;
  } | null>(null);
  const clearCart = useCartStore((state) => state.clearCart);

  const fulfillmentLabel = (status: string) => {
    switch (status) {
      case 'PREPARING':
        return t('status.preparing');
      case 'SHIPPED':
        return t('status.shipped');
      case 'DELIVERED':
        return t('status.delivered');
      case 'CANCELLED':
        return t('status.cancelled');
      case 'CANCELLING':
        return t('status.cancelling');
      default:
        return t('status.pending');
    }
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(numberLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(value));

  const formatOrderDate = (value: string) =>
    new Intl.DateTimeFormat(numberLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));

  const formatPrice = (value: number, currency: string = StoreConfig.currency) =>
    formatStorePrice(value, { locale: numberLocale, currency });

  useEffect(() => {
    const stripePaymentSuccess = sessionStorage.getItem('stripe_payment_success');

    if (stripePaymentSuccess === 'true') {
      clearCart();
      sessionStorage.removeItem('stripe_payment_success');
    }

    async function obtenerHistorial() {
      try {
        const res = await fetch('/api/orders', { cache: 'no-store' });

        if (res.ok) {
          const datos: Order[] = await res.json();
          setCompras(datos);
          return;
        }

        setErrorMsg(res.status === 401 ? t('errors.unauthenticated') : t('errors.load'));
      } catch (error) {
        console.error('Error loading order history:', error);
        setErrorMsg(t('errors.connection'));
      } finally {
        setLoading(false);
      }
    }

    void obtenerHistorial();
  }, [clearCart, t]);

  const cancelOrder = async (order: Order) => {
    if (!window.confirm(t('cancelConfirm'))) return;

    setCancellingOrderId(order.id);
    setCancelFeedback(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel`, {
        method: 'POST',
      });
      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        refundStatus?: string;
        paymentStatus?: string;
      };

      if (!response.ok || !data.success) {
        const message =
          data.error === 'TOO_LATE'
            ? t('errors.tooLate')
            : data.error === 'REFUND_DATA_MISSING'
              ? t('errors.refundDataMissing')
              : data.error === 'REFUND_FAILED'
                ? t('errors.refundFailed')
                : t('errors.cancelGeneric');
        setCancelFeedback({ orderId: order.id, error: true, text: message });
        return;
      }

      setCompras((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: data.paymentStatus || 'REFUND_PENDING',
                fulfillmentStatus: 'CANCELLED',
                refundStatus: data.refundStatus || null,
              }
            : item,
        ),
      );
      setCancelFeedback({ orderId: order.id, error: false, text: t('cancelSuccess') });
    } catch (error) {
      console.error('Error cancelling order:', error);
      setCancelFeedback({ orderId: order.id, error: true, text: t('errors.cancelGeneric') });
    } finally {
      setCancellingOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <p className="animate-pulse font-medium text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="mb-4 font-bold text-warning-foreground">⚠️ {errorMsg}</p>
          <NextLink
            href="/api/auth/signin"
            className="block rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-foreground/90"
          >
            {t('signIn')}
          </NextLink>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-black text-foreground">{t('title')}</h1>
          <Link href="/" className="text-sm font-bold text-primary hover:underline">
            {t('backToStore')}
          </Link>
        </div>

        {compras.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
            <p className="mb-4 text-lg text-muted-foreground">{t('empty')}</p>
            <Link
              href="/"
              className="inline-block h-10 rounded-lg bg-primary px-5 text-sm leading-10 font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t('shopNow')}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {compras.map((compra) => {
              const recipient = [compra.deliveryFirstName, compra.deliveryLastName]
                .filter(Boolean)
                .join(' ');
              const addressLines = deliveryLines(compra);
              const hasDeliveryData = Boolean(
                recipient || addressLines.length > 0 || compra.deliveryPhone,
              );

              return (
                <article
                  key={compra.id}
                  className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between border-b border-border pb-4">
                    <div>
                      <h2 className="text-sm font-bold text-foreground md:text-base">
                        {t('orderNumber', { id: formatOrderNumber(compra.orderNumber) })}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {t('date', { date: formatOrderDate(compra.createdAt) })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('paymentMethod', {
                          provider: paymentProviderLabel(compra.paymentProvider),
                        })}
                      </p>
                    </div>
                    {compra.fulfillmentStatus === 'CANCELLED' ? (
                      <span className="rounded-full bg-destructive/15 px-3 py-1 text-xs font-bold text-destructive">
                        {t('cancelledBadge')}
                      </span>
                    ) : (
                      <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success">
                        {t('approved')}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {compra.items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 text-sm text-muted-foreground"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
                            <Image
                              src={item.image}
                              alt={item.title}
                              fill
                              className="h-full w-full object-contain"
                              sizes="64px"
                            />
                          </div>
                          <p className="min-w-0">
                            <span className="font-medium text-foreground">{item.title}</span>{' '}
                            <span className="font-medium text-muted-foreground">
                              ×{item.quantity}
                            </span>
                            {item.size && (
                              <span className="block text-xs text-muted-foreground">
                                {t('size', { size: item.size.toUpperCase() })}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="shrink-0 font-semibold text-foreground">
                          {formatPrice(
                            calculateTaxBreakdown(
                              item.price,
                              compra.taxRate,
                              compra.currency,
                              compra.taxCalculationMethod === 'tax_inclusive_base'
                                ? 'tax_inclusive_base'
                                : 'tax_exclusive_base',
                            ).total * item.quantity,
                            compra.currency,
                          )}
                        </p>
                      </div>
                    ))}
                  </div>

                  <section className="rounded-xl border border-border bg-muted/40 p-4">
                    <h3 className="text-sm font-bold text-foreground">{t('deliveryAddress')}</h3>
                    {hasDeliveryData ? (
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-semibold text-foreground">{t('recipient')}:</span>{' '}
                          {recipient || '—'}
                        </p>
                        {addressLines.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                        {compra.deliveryPhone && (
                          <p>
                            <span className="font-semibold text-foreground">{t('phone')}:</span>{' '}
                            {compra.deliveryPhone}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">{t('noDeliveryData')}</p>
                    )}
                  </section>

                  <section className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {t('shippingStatus')}
                        </p>
                        <p className="font-bold text-foreground">
                          {fulfillmentLabel(compra.fulfillmentStatus || 'PENDING')}
                        </p>
                      </div>
                      {compra.estimatedDeliveryAt && (
                        <p className="text-xs text-muted-foreground">
                          {t('estimatedDelivery', {
                            date: formatDate(compra.estimatedDeliveryAt),
                          })}
                        </p>
                      )}
                    </div>

                    {(compra.shippingCarrier || compra.shippingService || compra.trackingCode) && (
                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        {compra.shippingCarrier && (
                          <p>{t('carrier', { carrier: compra.shippingCarrier })}</p>
                        )}
                        {compra.shippingService && (
                          <p>{t('service', { service: compra.shippingService })}</p>
                        )}
                        {compra.trackingCode && (
                          <p>{t('tracking', { code: compra.trackingCode })}</p>
                        )}
                        {compra.shippingTrackingUrl && (
                          <a
                            href={compra.shippingTrackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block font-semibold text-primary hover:underline"
                          >
                            {t('trackShipment')}
                          </a>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="rounded-xl border border-border bg-card p-4">
                    {compra.fulfillmentStatus === 'PENDING' && compra.canCancel ? (
                      <div className="space-y-3">
                        <p className="text-xs leading-5 text-muted-foreground">{t('cancelHint')}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => void cancelOrder(compra)}
                          disabled={cancellingOrderId === compra.id}
                          className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive transition hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {cancellingOrderId === compra.id ? t('cancelling') : t('cancelOrder')}
                        </Button>
                      </div>
                    ) : compra.fulfillmentStatus === 'CANCELLED' ? (
                      <p className="text-sm font-semibold text-foreground">
                        {compra.status === 'REFUNDED' ? t('refunded') : t('refundPending')}
                      </p>
                    ) : null}

                    {cancelFeedback?.orderId === compra.id && (
                      <p
                        className={`mt-3 text-sm font-medium ${
                          cancelFeedback.error ? 'text-destructive' : 'text-success'
                        }`}
                      >
                        {cancelFeedback.text}
                      </p>
                    )}
                  </section>

                  {((compra.taxRate !== null && compra.taxRate > 0) ||
                    compra.shippingAmount > 0 ||
                    compra.shippingQuoteRate !== null) && (
                    <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                      {compra.taxRate !== null && compra.taxRate > 0 && (
                        <>
                          <div className="flex items-center justify-between gap-4">
                            <span>Subtotal sin impuestos</span>
                            <span>{formatPrice(compra.subtotal, compra.currency)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>
                              {compra.taxName || 'Impuesto'} ({compra.taxRate}%)
                            </span>
                            <span>{formatPrice(compra.taxAmount, compra.currency)}</span>
                          </div>
                        </>
                      )}
                      {(compra.shippingAmount > 0 || compra.shippingQuoteRate !== null) && (
                        <div className="flex items-center justify-between gap-4">
                          <span>Envío</span>
                          <span>
                            {compra.shippingAmount > 0
                              ? formatPrice(compra.shippingAmount, compra.currency)
                              : 'Gratis'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border pt-4 font-black text-foreground">
                    <p className="text-sm">{t('totalPaid')}</p>
                    <p className="text-lg text-primary">
                      {formatPrice(compra.total, compra.currency)}
                    </p>
                  </div>
                  {compra.paymentTotal !== null && compra.paymentTotal !== undefined && (
                    <div className="mt-2 flex items-start justify-between gap-4 text-xs text-muted-foreground">
                      <p>Importe enviado a {paymentProviderLabel(compra.paymentProvider)}</p>
                      <p className="text-right font-semibold">
                        {formatPrice(compra.paymentTotal, compra.paymentCurrency)}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
