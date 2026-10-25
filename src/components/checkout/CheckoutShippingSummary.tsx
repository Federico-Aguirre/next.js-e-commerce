'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { CheckoutShippingOption } from '@/lib/shipping/types';

type Props = {
  selectedQuote: CheckoutShippingOption | null;
  availableQuotes: CheckoutShippingOption[];
  onSelectQuote: (quoteId: string) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  disabled?: boolean;
};

const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(amount);
}

function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function estimatedDeliveryLabel(value: string | null) {
  if (!value) return 'El transportista no informó una fecha estimada para esta opción.';

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12))
    : new Date(hasTimeZone ? value : `${value}-03:00`);

  if (Number.isNaN(date.getTime())) {
    return 'El transportista no informó una fecha estimada válida.';
  }

  const label = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long',
    timeZone: ARGENTINA_TIME_ZONE,
  }).format(date);
  const targetParts = dateParts(date);
  const todayParts = dateParts(new Date());
  const targetDay = Date.UTC(
    Number(targetParts.year),
    Number(targetParts.month) - 1,
    Number(targetParts.day),
  );
  const today = Date.UTC(
    Number(todayParts.year),
    Number(todayParts.month) - 1,
    Number(todayParts.day),
  );
  const daysUntil = Math.round((targetDay - today) / 86_400_000);

  if (daysUntil === 0) return `Entrega aproximada: hoy (${label}).`;
  if (daysUntil === 1) return `Entrega aproximada: mañana (${label}).`;
  if (daysUntil > 1) return `Entrega aproximada: ${label} (en unos ${daysUntil} días).`;
  return `Fecha estimada informada por el transportista: ${label}.`;
}

function choiceTitle(quote: CheckoutShippingOption) {
  return quote.meta.checkoutChoice === 'faster' ? 'Entrega más rápida' : 'Envío más económico';
}

export default function CheckoutShippingSummary({
  selectedQuote,
  availableQuotes,
  onSelectQuote,
  loading,
  error,
  onRetry,
  disabled = false,
}: Props) {
  const hasShippingChoice = availableQuotes.length > 1;

  return (
    <Card
      as="section"
      variant="flat"
      padding="default"
      className="mb-6 gap-4"
      aria-label="Detalle del pedido, impuestos y envío"
    >
      <h2 className="text-base font-bold text-foreground">Detalle del total</h2>

      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Calculando impuestos y cotizando el envío para tu dirección…
        </p>
      )}

      {error && !loading && (
        <div
          className="space-y-3 rounded-md border border-warning/25 bg-warning/10 p-3"
          role="alert"
        >
          <p className="text-sm text-warning-foreground">{error}</p>
          {/completá|completa|dirección|direccion/i.test(error) && (
            <Link
              href="/account"
              className="inline-block text-sm font-semibold text-warning-foreground underline"
            >
              Revisar dirección de entrega
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={disabled}
            onClick={onRetry}
            className="ml-3 cursor-pointer text-sm font-semibold text-warning-foreground underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Volver a cotizar
          </Button>
        </div>
      )}

      {!loading && !error && selectedQuote && (
        <div className="space-y-3">
          {hasShippingChoice ? (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold text-foreground">
                Elegí cómo querés recibir tu pedido
              </legend>
              {availableQuotes.map((quote) => {
                const isSelected = quote.id === selectedQuote.id;
                return (
                  <label
                    key={quote.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? 'border-primary bg-accent'
                        : 'border-border hover:border-primary/50'
                    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="radio"
                      name="checkoutShippingChoice"
                      value={quote.id}
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => onSelectQuote(quote.id)}
                      className="mt-1 size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block font-semibold text-foreground">
                        {choiceTitle(quote)}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {quote.carrier} · {quote.service}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {estimatedDeliveryLabel(quote.estimatedDeliveryAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold text-foreground">
                      {quote.shippingAmount === 0
                        ? 'Sin costo'
                        : money(quote.shippingAmount, quote.storeCurrency)}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <div className="rounded-md border border-primary/20 bg-accent p-3 text-sm">
              <p className="mb-1 text-xs font-semibold tracking-wide text-primary uppercase">
                Envío elegido automáticamente · tarifa más económica
              </p>
              <p className="font-semibold text-foreground">
                {selectedQuote.carrier} · {selectedQuote.service}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedQuote.shippingAmount === 0
                  ? 'Sin costo'
                  : `${money(selectedQuote.shippingAmount, selectedQuote.storeCurrency)} (incluido en el total)`}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {estimatedDeliveryLabel(selectedQuote.estimatedDeliveryAt)}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={disabled || loading}
              onClick={onRetry}
              className="cursor-pointer text-xs font-semibold text-primary underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Actualizar cotización de envío
            </Button>
          </div>

          <dl className="space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted-foreground">Subtotal de productos sin impuestos</dt>
              <dd className="text-right font-medium text-foreground">
                {money(selectedQuote.subtotal, selectedQuote.storeCurrency)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted-foreground">
                {selectedQuote.taxName}
                {selectedQuote.taxRate > 0 ? ` (${selectedQuote.taxRate}%)` : ''}
              </dt>
              <dd className="text-right font-medium text-foreground">
                {money(selectedQuote.taxAmount, selectedQuote.storeCurrency)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted-foreground">Envío</dt>
              <dd className="text-right font-medium text-foreground">
                {money(selectedQuote.shippingAmount, selectedQuote.storeCurrency)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-border pt-3 font-bold">
              <dt className="text-foreground">Total final a pagar</dt>
              <dd className="text-right text-lg text-foreground">
                {money(selectedQuote.totalInStoreCurrency, selectedQuote.storeCurrency)}
              </dd>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {selectedQuote.paymentCurrency === selectedQuote.storeCurrency
                ? `Se cobrará ${money(selectedQuote.paymentTotal, selectedQuote.paymentCurrency)}.`
                : `Importe que enviamos a la pasarela: ${money(selectedQuote.paymentTotal, selectedQuote.paymentCurrency)}. La conversión se fija al generar esta cotización.`}{' '}
              Las comisiones de procesamiento del proveedor no se suman por separado al cliente.
            </p>
          </dl>
        </div>
      )}
    </Card>
  );
}
