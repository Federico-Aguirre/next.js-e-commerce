'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProviderCurrency } from '@/lib/currency/payment-amount';
import type { CheckoutShippingOption } from '@/lib/shipping/types';
import type { CartItem } from '@/store/useCartStore';

type QuoteResult = {
  key: string;
  quotes: CheckoutShippingOption[];
  error: string | null;
};

type SelectedQuoteId = {
  key: string;
  id: string;
} | null;

type UseCheckoutShippingResult = {
  selectedQuote: CheckoutShippingOption | null;
  availableQuotes: CheckoutShippingOption[];
  selectQuote: (quoteId: string) => void;
  loading: boolean;
  error: string | null;
  refreshQuotes: () => void;
};

export function useCheckoutShipping(
  cartItems: CartItem[],
  paymentCurrency: ProviderCurrency,
  enabled = true,
  deliveryAddressId: string | null = null,
): UseCheckoutShippingResult {
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<SelectedQuoteId>(null);

  const items = useMemo(
    () =>
      cartItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        articleId: item.articleId,
        variantId: item.variantId,
        colorName: item.colorName,
        title: item.title,
        quantity: item.quantity,
        size: item.size,
      })),
    [cartItems],
  );
  const requestBody = useMemo(
    () => JSON.stringify({ items, paymentCurrency, deliveryAddressId }),
    [items, paymentCurrency, deliveryAddressId],
  );
  const queryKey = useMemo(
    () => JSON.stringify({ requestBody, enabled, refreshKey }),
    [requestBody, enabled, refreshKey],
  );

  const refreshQuotes = useCallback(() => setRefreshKey((value) => value + 1), []);
  const selectQuote = useCallback(
    (quoteId: string) => setSelectedQuoteId({ key: queryKey, id: quoteId }),
    [queryKey],
  );

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const controller = new AbortController();

    void fetch('/api/checkout/shipping-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
      body: requestBody,
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          quotes?: CheckoutShippingOption[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || 'No se pudo cotizar el envío.');
        if (!Array.isArray(data.quotes) || data.quotes.length < 1 || data.quotes.length > 2) {
          throw new Error('No se pudo determinar una opción de envío válida. Volvé a cotizar.');
        }
        if (
          data.quotes.some((quote) => !quote.quoteToken || !Number.isFinite(quote.paymentTotal))
        ) {
          throw new Error('La cotización recibida está incompleta. Volvé a intentar.');
        }
        if (active) setResult({ key: queryKey, quotes: data.quotes, error: null });
      })
      .catch((requestError: unknown) => {
        if (
          !active ||
          (requestError instanceof DOMException && requestError.name === 'AbortError')
        ) {
          return;
        }
        setResult({
          key: queryKey,
          quotes: [],
          error:
            requestError instanceof Error
              ? requestError.message
              : 'No se pudo cotizar el envío. Revisá tu dirección e intentá nuevamente.',
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, queryKey, requestBody]);

  const currentResult = enabled && result?.key === queryKey ? result : null;
  const availableQuotes = currentResult && currentResult.error === null ? currentResult.quotes : [];
  const selectedQuote =
    availableQuotes.find(
      (quote) => selectedQuoteId?.key === queryKey && selectedQuoteId.id === quote.id,
    ) ??
    availableQuotes[0] ??
    null;

  return {
    selectedQuote,
    availableQuotes,
    selectQuote,
    loading: enabled && currentResult === null,
    error: currentResult?.error ?? null,
    refreshQuotes,
  };
}
