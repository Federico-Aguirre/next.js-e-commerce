import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CartItem } from '@/store/useCartStore';
import {
  fetchCheckoutShippingQuotes,
  type MobileCheckoutQuote,
} from '@/services/checkoutShipping';

type QuoteResult = {
  key: string;
  quotes: MobileCheckoutQuote[];
  error: string | null;
};

type SelectedQuoteId = {
  key: string;
  id: string;
} | null;

export function useCheckoutShippingQuotes(
  apiBaseUrl: string,
  items: CartItem[],
  enabled = true,
) {
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedQuoteId, setSelectedQuoteId] = useState<SelectedQuoteId>(null);
  const requestItems = useMemo(
    () => items.map((item) => ({ ...item })),
    [items],
  );
  const requestKey = useMemo(
    () => JSON.stringify({ apiBaseUrl, enabled, refreshKey, requestItems }),
    [apiBaseUrl, enabled, refreshKey, requestItems],
  );

  const refreshQuotes = useCallback(
    () => setRefreshKey((value) => value + 1),
    [],
  );
  const selectQuote = useCallback(
    (quoteId: string) => setSelectedQuoteId({ key: requestKey, id: quoteId }),
    [requestKey],
  );

  useEffect(() => {
    if (!enabled || !apiBaseUrl || requestItems.length === 0) return;

    let active = true;
    void fetchCheckoutShippingQuotes(apiBaseUrl, requestItems, 'ARS')
      .then((quotes) => {
        if (!active) return;
        if (quotes.length < 1 || quotes.length > 2) {
          throw new Error(
            'No se pudo determinar una opción de entrega válida. Volvé a cotizar.',
          );
        }
        setResult({ key: requestKey, quotes, error: null });
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setResult({
          key: requestKey,
          quotes: [],
          error:
            requestError instanceof Error
              ? requestError.message
              : 'No se pudo cotizar el envío para tu dirección.',
        });
      });

    return () => {
      active = false;
    };
  }, [requestKey, apiBaseUrl, requestItems, enabled]);

  const currentResult = enabled && result?.key === requestKey ? result : null;
  const availableQuotes =
    currentResult && currentResult.error === null ? currentResult.quotes : [];
  const quote =
    availableQuotes.find(
      (item) =>
        selectedQuoteId?.key === requestKey && selectedQuoteId.id === item.id,
    ) ??
    availableQuotes[0] ??
    null;

  return {
    quote,
    availableQuotes,
    selectQuote,
    refreshQuotes,
    loading:
      enabled &&
      Boolean(apiBaseUrl) &&
      requestItems.length > 0 &&
      currentResult === null,
    error:
      enabled && !apiBaseUrl
        ? 'La aplicación no tiene configurada una URL válida para cotizar el envío.'
        : (currentResult?.error ?? null),
  };
}
