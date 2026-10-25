import { authenticatedFetch } from '@/services/authenticatedFetch';
import type { CartItem } from '@/store/useCartStore';

export type MobileCheckoutQuote = {
  id: string;
  provider: 'ZIPNOVA' | 'SHIPPO' | 'LOCAL';
  carrier: string;
  service: string;
  amount: number;
  currency: string;
  estimatedDeliveryAt: string | null;
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  taxCalculationMethod: string;
  taxName: string;
  taxCountry: string;
  productTotal: number;
  shippingAmount: number;
  totalInStoreCurrency: number;
  paymentShippingAmount: number;
  paymentTotal: number;
  paymentCurrency: 'ARS' | 'USD';
  paymentExchangeRate: number;
  storeCurrency: string;
  quoteToken: string;
  meta: Record<string, string | number | null>;
};

/** The quote request and payment request must use the same SKU identifiers and quantities. */
export function checkoutItemsPayload(items: CartItem[]) {
  return items.map((item) => ({
    id: item.id,
    productId: String(item.id),
    articleId: item.articleId,
    title: item.title,
    price: Number(item.price),
    quantity: Number(item.quantity),
    image: item.image || '',
    size: item.size,
    colorName: item.colorName,
  }));
}

export async function fetchCheckoutShippingQuotes(
  apiBaseUrl: string,
  items: CartItem[],
  paymentCurrency: 'ARS' | 'USD' = 'ARS',
): Promise<MobileCheckoutQuote[]> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/api/checkout/shipping-quote`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        items: checkoutItemsPayload(items),
        paymentCurrency,
      }),
    },
  );
  const result = (await response.json().catch(() => ({}))) as {
    quotes?: MobileCheckoutQuote[];
    error?: string;
  };
  if (!response.ok)
    throw new Error(result.error || 'No se pudo cotizar el envío.');
  if (
    !Array.isArray(result.quotes) ||
    result.quotes.length < 1 ||
    result.quotes.length > 2
  ) {
    throw new Error(
      'No se pudo determinar una opción de entrega válida. Volvé a cotizar.',
    );
  }
  if (
    result.quotes.some(
      (quote) => !quote.quoteToken || !Number.isFinite(quote.paymentTotal),
    )
  ) {
    throw new Error(
      'La cotización de envío está incompleta. Volvé a intentar.',
    );
  }
  return result.quotes;
}

export function formatCheckoutDeliveryEstimate(value: string | null) {
  if (!value)
    return 'El transportista no informó una fecha estimada para esta opción.';

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = dateOnly
    ? new Date(
        Date.UTC(
          Number(dateOnly[1]),
          Number(dateOnly[2]) - 1,
          Number(dateOnly[3]),
          12,
        ),
      )
    : new Date(hasTimeZone ? value : `${value}-03:00`);

  if (Number.isNaN(date.getTime())) {
    return 'El transportista no informó una fecha estimada válida.';
  }

  const dateLabel = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date);
  return `Entrega aproximada: ${dateLabel}.`;
}

export function formatCheckoutMoney(amount: number, currency = 'ARS') {
  return new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(amount);
}
