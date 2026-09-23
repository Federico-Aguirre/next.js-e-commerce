'use client';

import { useCallback, useEffect, useState } from 'react';

import type { CartItem, PayPalCardSession, PayPalSDK } from './types';

const PAYPAL_SCRIPT = 'https://www.sandbox.paypal.com/web-sdk/v6/core';

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
};

export function usePayPalCardPayment({
  cartItems,
  onSuccess,
}: UsePayPalCardPaymentParams) {
  const [sdkLoaded, setSdkLoaded] = useState(false);

  const [session, setSession] = useState<PayPalCardSession | null>(null);

  const [ready, setReady] = useState(false);

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);

  const loadSDK = useCallback(() => {
    setSdkLoaded(true);
  }, []);

  const handleSDKError = useCallback(() => {
    setErrorMessage('No se pudo cargar el SDK de PayPal.');
  }, []);

  useEffect(() => {
    if (!sdkLoaded || !window.paypal || session) {
      return;
    }

    let cancelled = false;

    async function initializePayPal() {
      try {
        setErrorMessage(null);
        setReady(false);

        const tokenResponse = await fetch(
          '/api/paypal/auth/browser-safe-client-token',
          {
            method: 'GET',
            cache: 'no-store',
          },
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || !tokenData.accessToken) {
          throw new Error(
            tokenData.message || 'No se pudo obtener el token de PayPal.',
          );
        }

        if (cancelled) {
          return;
        }

        const sdk = await window.paypal!.createInstance({
          clientToken: tokenData.accessToken,
          components: ['card-fields'],
          pageType: 'checkout',
        });

        const eligibility = await sdk.findEligibleMethods({
          currencyCode: 'USD',
        });

        if (!eligibility.isEligible('advanced_cards')) {
          throw new Error(
            'Los pagos con tarjeta de PayPal no están disponibles para esta cuenta Sandbox.',
          );
        }

        const cardSession = sdk.createCardFieldsOneTimePaymentSession();

        if (cancelled) {
          return;
        }

        setSession(cardSession);
      } catch (error: unknown) {
        console.error('❌ Error inicializando PayPal:', error);

        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'No se pudo inicializar PayPal.',
          );
        }
      }
    }

    initializePayPal();

    return () => {
      cancelled = true;
    };
  }, [sdkLoaded, session]);

  const createPayPalOrder = useCallback(async () => {
    const itemsPayload = cartItems.map((item) => ({
      articleId: item.articleId ?? item.productId ?? item.id,

      productId: item.productId ?? item.articleId ?? item.id,

      title: item.title,
      price: Number(item.price),
      quantity: Number(item.quantity),
      image: item.image,
      size: item.size,
      colorName: item.colorName,
    }));

    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: itemsPayload,
        paymentMethod: 'paypal',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.paypalOrderId || !data.orderId) {
      throw new Error(
        data.error || data.message || 'No se pudo crear la orden de PayPal.',
      );
    }

    setPaypalOrderId(data.paypalOrderId);

    return {
      paypalOrderId: data.paypalOrderId as string,

      localOrderId: data.orderId as string,
    };
  }, [cartItems]);

  const submitPayment = useCallback(async () => {
    if (!session || loading) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const order = await createPayPalOrder();

      const result = await session.submit(order.paypalOrderId, {
        billingAddress: {
          addressLine1: '123 Market Street',
          addressLine2: 'Suite 400',
          adminArea1: 'CA',
          adminArea2: 'San Francisco',
          countryCode: 'US',
          postalCode: '94105',
        },
      });

      if (result.state === 'canceled') {
        setErrorMessage('La operación con PayPal fue cancelada.');

        return;
      }

      if (result.state !== 'succeeded') {
        throw new Error(
          result.data?.message || 'PayPal no pudo completar el pago.',
        );
      }

      const capturedPaypalOrderId = result.data?.orderId || order.paypalOrderId;

      const captureResponse = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paypalOrderId: capturedPaypalOrderId,

          orderId: order.localOrderId,
        }),
      });

      const captureResult = await captureResponse.json();

      if (!captureResponse.ok) {
        throw new Error(
          captureResult.message || 'No se pudo confirmar el pago de PayPal.',
        );
      }

      alert('¡Compra realizada con éxito!');

      onSuccess();
    } catch (error: unknown) {
      console.error('❌ Error procesando PayPal:', error);

      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo procesar el pago.',
      );
    } finally {
      setLoading(false);
    }
  }, [session, loading, createPayPalOrder, onSuccess]);

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
    paypalOrderId,
    submitPayment,
  };
}
