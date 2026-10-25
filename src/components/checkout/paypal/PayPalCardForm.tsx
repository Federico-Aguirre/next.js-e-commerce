'use client';

import Script from 'next/script';
import { useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import PayPalCardFields from './PayPalCardFields';
import PayPalPaymentButton from './PayPalPaymentButton';
import PayPalTestData from './PayPalTestData';
import type { PayPalCardFormProps } from './types';
import { usePayPalCardPayment } from './usePayPalCardPayment';

export default function PayPalCardForm({
  cartItems,
  onSuccess,
  shippingQuoteToken,
  paymentTotal,
  deliveryAddressId,
  onPaymentBusyChange,
}: PayPalCardFormProps) {
  const quoteAvailable = Boolean(shippingQuoteToken && paymentTotal !== null && paymentTotal > 0);
  const estimatedTotalUsd = paymentTotal ?? 0;

  const {
    scriptUrl,
    loadSDK,
    handleSDKError,
    session,
    ready,
    setReady,
    loading,
    errorMessage,
    setErrorMessage,
    cardFieldsError,
    submitPayment,
    paypalOrderId,
    savedCards,
    cardsLoading,
    cardFieldsMounted,
    selectedPaymentMethod,
    choosePaymentMethod,
    saveCard,
    changeSaveCard,
    removeSavedCard,
  } = usePayPalCardPayment({
    cartItems,
    onSuccess,
    shippingQuoteToken,
    deliveryAddressId,
  });

  const handleFieldsReady = useCallback(() => {
    setReady(true);
  }, [setReady]);

  const handleFieldsError = useCallback(
    (message: string) => {
      setReady(false);
      setErrorMessage(message);
    },
    [setReady, setErrorMessage],
  );

  useEffect(() => {
    onPaymentBusyChange?.(loading || Boolean(paypalOrderId));
  }, [loading, paypalOrderId, onPaymentBusyChange]);

  const selectedSavedCard = savedCards.find((card) => card.id === selectedPaymentMethod);
  const activeOrder = Boolean(paypalOrderId);
  const formLoading =
    selectedPaymentMethod === 'new' &&
    !cardsLoading &&
    cardFieldsMounted &&
    !ready &&
    !cardFieldsError &&
    !errorMessage;

  return (
    <div className="space-y-5">
      <Script
        src={scriptUrl}
        strategy="afterInteractive"
        onLoad={loadSDK}
        onError={handleSDKError}
      />

      <PayPalTestData />

      {cardsLoading && (
        <p
          className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
          role="status"
        >
          Consultando tus tarjetas guardadas…
        </p>
      )}

      {!cardsLoading && savedCards.length > 0 && (
        <section aria-label="Tarjetas guardadas de PayPal" className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">Elegí cómo querés pagar</h2>
          <div
            className="flex snap-x gap-3 overflow-x-auto pb-2"
            role="group"
            aria-label="Elegir tarjeta o agregar una nueva"
          >
            {savedCards.map((card) => {
              const selected = selectedPaymentMethod === card.id;
              return (
                <div
                  key={card.id}
                  className={`min-w-48 snap-start rounded-xl border p-3 ${selected ? 'border-paypal bg-accent ring-1 ring-paypal' : 'border-border bg-card'}`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={activeOrder || loading}
                    onClick={() => choosePaymentMethod(card.id)}
                    aria-pressed={selected}
                    className="w-full text-left focus-visible:outline-2 focus-visible:outline-paypal disabled:cursor-not-allowed"
                  >
                    <span className="block text-sm font-bold text-foreground">{card.brand}</span>
                    <span className="mt-1 block text-sm text-foreground">
                      •••• {card.lastFourDigits || '----'}
                    </span>
                    {card.expirationMonth && card.expirationYear && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Vence {String(card.expirationMonth).padStart(2, '0')}/{card.expirationYear}
                      </span>
                    )}
                    {selected && (
                      <span className="mt-2 block text-xs font-semibold text-paypal">
                        Seleccionada
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={activeOrder || loading}
                    onClick={() => void removeSavedCard(card.id)}
                    className="mt-3 cursor-pointer text-xs font-medium text-destructive underline decoration-dotted underline-offset-2 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Eliminar tarjeta
                  </Button>
                </div>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={activeOrder || loading}
              onClick={() => choosePaymentMethod('new')}
              aria-pressed={selectedPaymentMethod === 'new'}
              className={`min-w-48 snap-start rounded-xl border border-dashed p-4 text-left focus-visible:outline-2 focus-visible:outline-paypal disabled:cursor-not-allowed ${selectedPaymentMethod === 'new' ? 'border-paypal bg-accent ring-1 ring-paypal' : 'border-border bg-muted/40 hover:border-paypal'}`}
            >
              <span className="block text-lg font-semibold text-paypal">＋</span>
              <span className="block text-sm font-bold text-foreground">Agregar nueva tarjeta</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Ingresar otros datos de tarjeta
              </span>
            </Button>
          </div>
          {activeOrder && (
            <p className="text-xs text-muted-foreground">
              Hay una operación pendiente con PayPal. Reintentá el mismo pago antes de cambiar de
              tarjeta.
            </p>
          )}
        </section>
      )}

      {!cardsLoading && cardFieldsMounted && (
        <PayPalCardFields
          session={session}
          onReady={handleFieldsReady}
          onError={handleFieldsError}
          className={selectedPaymentMethod === 'new' ? '' : 'hidden'}
        />
      )}

      {selectedPaymentMethod === 'new' && !cardsLoading && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
          <Checkbox
            type="checkbox"
            checked={saveCard}
            disabled={activeOrder || loading}
            onChange={(event) => changeSaveCard(event.target.checked)}
            className="mt-0.5 size-4 accent-paypal"
          />
          <span>
            <span className="block font-semibold text-foreground">
              Guardar esta tarjeta para futuras compras
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              PayPal la guardará en su bóveda segura si la cuenta está habilitada. Esta tienda no
              guarda el número completo ni el código de seguridad.
            </span>
          </span>
        </label>
      )}

      {selectedSavedCard && !cardsLoading && (
        <div className="rounded-xl border border-paypal/20 bg-accent p-4">
          <p className="text-sm font-bold text-foreground">
            Vas a pagar con {selectedSavedCard.brand}
            {selectedSavedCard.lastFourDigits
              ? ` terminada en ${selectedSavedCard.lastFourDigits}`
              : ''}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            PayPal puede requerir una verificación adicional para autorizar el pago.
          </p>
        </div>
      )}

      {(errorMessage || (selectedPaymentMethod === 'new' ? cardFieldsError : null)) && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3" role="alert">
          <p className="text-sm font-medium text-destructive">{errorMessage || cardFieldsError}</p>
        </div>
      )}

      <PayPalPaymentButton
        amount={estimatedTotalUsd}
        loading={loading}
        formLoading={formLoading}
        ready={!cardsLoading && quoteAvailable && (selectedSavedCard ? true : ready)}
        onClick={submitPayment}
      />
    </div>
  );
}
