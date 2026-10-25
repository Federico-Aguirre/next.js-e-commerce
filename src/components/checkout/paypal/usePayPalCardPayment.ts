'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CartItem, PayPalCardSession, PayPalSDK, SavedPayPalCard } from './types';

const PAYPAL_SCRIPT =
  process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT === 'production'
    ? 'https://www.paypal.com/web-sdk/v6/core'
    : 'https://www.sandbox.paypal.com/web-sdk/v6/core';

declare global {
  interface Window {
    paypal?: {
      createInstance: (options: {
        clientToken: string;
        components: string[];
        pageType?: string;
      }) => Promise<PayPalSDK>;
    };
  }
}

type UsePayPalCardPaymentParams = {
  cartItems: CartItem[];
  onSuccess: () => void;
  shippingQuoteToken: string | null;
  deliveryAddressId?: string | null;
};

type CreateOrderOptions = {
  savePaymentMethod: boolean;
  savedPaymentMethodId?: string;
};

export function usePayPalCardPayment({
  cartItems,
  onSuccess,
  shippingQuoteToken,
  deliveryAddressId,
}: UsePayPalCardPaymentParams) {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [session, setSession] = useState<PayPalCardSession | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cardFieldsError, setCardFieldsError] = useState<string | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<SavedPayPalCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardFieldsMounted, setCardFieldsMounted] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('new');
  const [saveCard, setSaveCard] = useState(true);
  const checkoutKeyRef = useRef<string | null>(null);

  useEffect(() => {
    checkoutKeyRef.current = null;
  }, [shippingQuoteToken]);

  const loadSDK = useCallback(() => setSdkLoaded(true), []);
  const handleSDKError = useCallback(
    () => setErrorMessage('No se pudo cargar el SDK de PayPal.'),
    [],
  );

  useEffect(() => {
    let active = true;
    void fetch('/api/payment-methods/paypal', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return { cards: [] as SavedPayPalCard[] };
        const data = (await response.json()) as { cards?: SavedPayPalCard[] };
        return { cards: Array.isArray(data.cards) ? data.cards : [] };
      })
      .then(({ cards }) => {
        if (!active) return;
        setSavedCards(cards);
        setSelectedPaymentMethod(cards[0]?.id ?? 'new');
        if (cards.length === 0) setCardFieldsMounted(true);
      })
      .catch(() => {
        if (active) {
          setSavedCards([]);
          setSelectedPaymentMethod('new');
          setCardFieldsMounted(true);
        }
      })
      .finally(() => {
        if (active) setCardsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sdkLoaded || !window.paypal || session) return;

    let cancelled = false;
    async function initializePayPal() {
      try {
        setErrorMessage(null);
        setReady(false);
        const configResponse = await fetch('/api/paypal/auth/browser-safe-client-token', {
          method: 'GET',
          cache: 'no-store',
        });
        const configData = await configResponse.json();
        if (!configResponse.ok || !configData.clientToken) {
          throw new Error(configData.message || 'No se pudo obtener el client token de PayPal.');
        }
        if (cancelled) return;

        const sdk = await window.paypal!.createInstance({
          clientToken: configData.clientToken,
          components: ['card-fields'],
          pageType: 'checkout',
        });
        const eligibility = await sdk.findEligibleMethods({ currencyCode: 'USD' });
        if (!eligibility.isEligible('advanced_cards')) {
          if (!cancelled) {
            setCardFieldsError(
              'PayPal no habilitó el ingreso de una tarjeta nueva para esta cuenta. Podés probar una tarjeta ya guardada si aparece en la lista.',
            );
          }
          return;
        }

        const cardSession = sdk.createCardFieldsOneTimePaymentSession();
        if (!cancelled) {
          setSession(cardSession);
          setCardFieldsError(null);
        }
      } catch (error: unknown) {
        console.error(
          'Error inicializando PayPal:',
          error instanceof Error ? error.name : 'UnknownError',
        );
        if (!cancelled) {
          setCardFieldsError(
            error instanceof Error
              ? error.message
              : 'No se pudieron inicializar los campos de tarjeta de PayPal.',
          );
        }
      }
    }

    void initializePayPal();
    return () => {
      cancelled = true;
    };
  }, [sdkLoaded, session]);

  const choosePaymentMethod = useCallback(
    (methodId: string) => {
      if (loading || paypalOrderId) return;
      setSelectedPaymentMethod(methodId);
      if (methodId === 'new') {
        // When saved cards exist, defer mounting the PayPal iframes until the buyer asks for a new card.
        if (!cardFieldsMounted) setReady(false);
        setCardFieldsMounted(true);
      }
      setSaveCard(methodId === 'new');
      setErrorMessage(null);
      checkoutKeyRef.current = null;
    },
    [cardFieldsMounted, loading, paypalOrderId],
  );

  const changeSaveCard = useCallback(
    (checked: boolean) => {
      if (loading || paypalOrderId) return;
      setSaveCard(checked);
      setErrorMessage(null);
      checkoutKeyRef.current = null;
    },
    [loading, paypalOrderId],
  );

  const refreshSavedCards = useCallback(async () => {
    const response = await fetch('/api/payment-methods/paypal', { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { cards?: SavedPayPalCard[] };
    if (Array.isArray(data.cards)) setSavedCards(data.cards);
  }, []);

  const removeSavedCard = useCallback(
    async (savedPaymentMethodId: string) => {
      if (loading || paypalOrderId) return;
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetch('/api/payment-methods/paypal', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ savedPaymentMethodId }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error || 'No se pudo quitar la tarjeta.');
        const remaining = savedCards.filter((card) => card.id !== savedPaymentMethodId);
        setSavedCards(remaining);
        if (remaining.length === 0) setCardFieldsMounted(true);
        if (selectedPaymentMethod === savedPaymentMethodId) {
          setSelectedPaymentMethod(remaining[0]?.id ?? 'new');
          if (remaining.length === 0) setSaveCard(true);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'No se pudo quitar la tarjeta.');
      } finally {
        setLoading(false);
      }
    },
    [loading, paypalOrderId, savedCards, selectedPaymentMethod],
  );

  const createPayPalOrder = useCallback(
    async (options: CreateOrderOptions) => {
      if (!shippingQuoteToken) {
        throw new Error('Primero cotizá y seleccioná una opción de envío.');
      }
      const itemsPayload = cartItems.map((item) => ({
        articleId: item.articleId ?? item.productId ?? item.id,
        productId: item.productId ?? item.articleId ?? item.id,
        variantId: item.variantId,
        title: item.title,
        price: Number(item.price),
        quantity: Number(item.quantity),
        image: item.image,
        size: item.size,
        colorName: item.colorName,
      }));

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsPayload,
          paymentMethod: 'paypal',
          checkoutKey: checkoutKeyRef.current || (checkoutKeyRef.current = crypto.randomUUID()),
          savePaymentMethod: options.savePaymentMethod,
          shippingQuoteToken,
          ...(deliveryAddressId ? { deliveryAddressId } : {}),
          ...(options.savedPaymentMethodId
            ? { savedPaymentMethodId: options.savedPaymentMethodId }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.paypalOrderId || !data.orderId) {
        throw new Error(data.error || data.message || 'No se pudo crear la orden de PayPal.');
      }

      setPaypalOrderId(data.paypalOrderId as string);
      return { paypalOrderId: data.paypalOrderId as string, localOrderId: data.orderId as string };
    },
    [cartItems, deliveryAddressId, shippingQuoteToken],
  );

  const submitPayment = useCallback(async () => {
    if (loading || cardsLoading) return;
    const savedPaymentMethodId =
      selectedPaymentMethod === 'new' ? undefined : selectedPaymentMethod;
    if (!savedPaymentMethodId && !session) {
      setErrorMessage(
        cardFieldsError || 'Los campos de tarjeta de PayPal no están disponibles para esta cuenta.',
      );
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    let localOrderId: string | null = null;
    let cardSubmissionSucceeded = false;

    try {
      const order = await createPayPalOrder({
        savePaymentMethod: !savedPaymentMethodId && saveCard,
        savedPaymentMethodId,
      });
      localOrderId = order.localOrderId;
      let capturedPaypalOrderId = order.paypalOrderId;

      if (savedPaymentMethodId) {
        // The vault token was checked against this account server-side. There are no card fields to submit.
        cardSubmissionSucceeded = true;
      } else {
        if (!session) {
          throw new Error(
            cardFieldsError ||
              'Los campos de tarjeta de PayPal no están disponibles para esta cuenta.',
          );
        }
        const result = await session.submit(order.paypalOrderId, {
          billingAddress: { postalCode: '95131' },
        });
        if (result.state === 'canceled') throw new Error('La operación con PayPal fue cancelada.');
        if (result.state !== 'succeeded') {
          throw new Error(result.data?.message || 'PayPal no pudo completar el pago.');
        }
        cardSubmissionSucceeded = true;
        capturedPaypalOrderId = result.data?.orderId || order.paypalOrderId;
      }

      const captureResponse = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paypalOrderId: capturedPaypalOrderId,
          orderId: order.localOrderId,
          ...(savedPaymentMethodId ? { savedPaymentMethodId } : {}),
        }),
      });
      const captureResult = await captureResponse.json();
      if (!captureResponse.ok)
        throw new Error(captureResult.message || 'No se pudo confirmar el pago de PayPal.');

      await refreshSavedCards();
      alert('¡Compra realizada con éxito!');
      onSuccess();
    } catch (error: unknown) {
      console.error(
        'Error procesando PayPal:',
        error instanceof Error ? error.name : 'UnknownError',
      );
      if (localOrderId && !cardSubmissionSucceeded) {
        try {
          await fetch('/api/checkout', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: localOrderId }),
          });
        } catch (cleanupError) {
          console.error(
            'No se pudo liberar la reserva fallida de PayPal:',
            cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
          );
        }
        checkoutKeyRef.current = null;
        setPaypalOrderId(null);
      } else if (!localOrderId) {
        checkoutKeyRef.current = null;
        setPaypalOrderId(null);
      }

      const message = error instanceof Error ? error.message : 'No se pudo procesar el pago.';
      setErrorMessage(
        message.includes('PAYER_CANNOT_PAY')
          ? 'PayPal Sandbox rechazó el pago (PAYER_CANNOT_PAY). La reserva fue liberada; no es necesario cambiar de tarjeta.'
          : message,
      );
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    session,
    cardsLoading,
    cardFieldsError,
    selectedPaymentMethod,
    saveCard,
    createPayPalOrder,
    refreshSavedCards,
    onSuccess,
  ]);

  return {
    scriptUrl: PAYPAL_SCRIPT,
    loadSDK,
    handleSDKError,
    session,
    ready,
    setReady,
    loading,
    errorMessage,
    setErrorMessage,
    cardFieldsError,
    paypalOrderId,
    savedCards,
    cardsLoading,
    cardFieldsMounted,
    selectedPaymentMethod,
    choosePaymentMethod,
    saveCard,
    changeSaveCard,
    removeSavedCard,
    submitPayment,
  };
}
