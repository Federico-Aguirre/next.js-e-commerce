import type { CheckoutShippingOption } from './types';

/**
 * Selects the cheapest delivery-to-address service in the store currency.
 * Store pickup is deliberately excluded because it does not deliver to the buyer's address.
 */
export function selectCheapestDeliveryQuote(
  quotes: CheckoutShippingOption[],
): CheckoutShippingOption | null {
  const deliveryQuotes = quotes.filter(
    (quote) => !(quote.provider === 'LOCAL' && quote.meta.kind === 'pickup'),
  );

  deliveryQuotes.sort(
    (a, b) =>
      a.shippingAmount - b.shippingAmount ||
      (a.estimatedDeliveryAt ?? '').localeCompare(b.estimatedDeliveryAt ?? '') ||
      a.carrier.localeCompare(b.carrier) ||
      a.service.localeCompare(b.service),
  );

  return deliveryQuotes[0] ?? null;
}

/**
 * Offers at most one expedited alternative, and only when its carrier-provided ETA
 * proves it arrives before the default option. When the default ETA is absent,
 * an explicitly expedited service name plus its own ETA is required.
 */
export function selectFasterDeliveryQuote(
  quotes: CheckoutShippingOption[],
  defaultQuote: CheckoutShippingOption,
): CheckoutShippingOption | null {
  const defaultEta = defaultQuote.estimatedDeliveryAt
    ? Date.parse(defaultQuote.estimatedDeliveryAt)
    : Number.NaN;
  const hasDefaultEta = Number.isFinite(defaultEta);
  const expeditedName =
    /(?:same[\s_-]?day|today|flex|express|expres|overnight|next[\s_-]?day|24\s*(?:h|hs|horas)|en\s+el\s+d[ií]a|d[ií]a\s+siguiente|urgente|priority|prioritario|r[aá]pido)/i;

  return (
    quotes
      .filter((quote) => {
        if (
          quote.id === defaultQuote.id ||
          (quote.provider === 'LOCAL' && quote.meta.kind === 'pickup')
        ) {
          return false;
        }

        if (!quote.estimatedDeliveryAt) return false;
        const eta = Date.parse(quote.estimatedDeliveryAt);
        if (!Number.isFinite(eta)) return false;

        if (hasDefaultEta) return eta < defaultEta;

        return expeditedName.test(`${quote.service} ${String(quote.meta.serviceType ?? '')}`);
      })
      .sort((a, b) => {
        const etaDifference =
          Date.parse(a.estimatedDeliveryAt!) - Date.parse(b.estimatedDeliveryAt!);
        return (
          etaDifference || a.shippingAmount - b.shippingAmount || a.carrier.localeCompare(b.carrier)
        );
      })[0] ?? null
  );
}
