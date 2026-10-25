'use client';

import { loadMercadoPago } from '@mercadopago/sdk-js';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { CartItem } from '@/store/useCartStore';
import { useCartStore } from '@/store/useCartStore';

type Props = {
  cartItems: CartItem[];
  cartTotal: number;
  shippingQuoteToken: string | null;
  paymentTotal: number | null;
  deliveryAddressId?: string | null;
  onPaymentBusyChange?: (busy: boolean) => void;
};

type CardFormData = {
  paymentMethodId?: string;
  issuerId?: string;
  cardholderEmail?: string;
  amount?: string;
  token?: string;
  installments?: string;
  identificationNumber?: string;
  identificationType?: string;
};

type CardFormInstance = {
  getCardFormData: () => CardFormData;
  unmount?: () => void;
};

type SavedCard = {
  id: string;
  cardId: string;
  paymentMethodId: string;
  paymentType: string | null;
  brand: string;
  lastFourDigits: string | null;
  expirationMonth: number | null;
  expirationYear: number | null;
};

type SecureField = {
  mount: (element: string | HTMLElement) => unknown;
  unmount?: () => void;
};

type MercadoPagoInstance = {
  cardForm: (options: Record<string, unknown>) => CardFormInstance;
  fields: {
    create: (field: 'securityCode', options?: Record<string, unknown>) => SecureField;
    createCardToken: (options: { cardId: string }) => Promise<{ id?: string }>;
  };
};

type MercadoPagoConstructor = new (
  publicKey: string,
  options?: { locale?: string },
) => MercadoPagoInstance;

type ProcessOrderInput = {
  token: string;
  paymentMethodId?: string;
  issuerId?: string;
  email?: string;
  docType?: string;
  docNumber?: string;
  installments?: number;
  savedPaymentMethodId?: string;
};

function setNativeValue(id: string, value: string) {
  const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (!element) return;
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function brandLabel(brand: string) {
  return brand
    .trim()
    .replace(/_/g, ' ')
    .replace(/^./, (letter) => letter.toLocaleUpperCase('es-AR'));
}

function cardLabel(card: SavedCard) {
  return card.lastFourDigits ? `terminada en ${card.lastFourDigits}` : 'tarjeta guardada';
}

export default function MercadoPagoCardForm({
  cartItems,
  cartTotal,
  shippingQuoteToken,
  paymentTotal,
  deliveryAddressId,
  onPaymentBusyChange,
}: Props) {
  const router = useRouter();
  const finishCheckout = useCartStore((state) => state.finishCheckout);
  const canQuoteArsTotal = Boolean(
    shippingQuoteToken &&
    paymentTotal !== null &&
    Number.isFinite(paymentTotal) &&
    paymentTotal > 0,
  );
  const finalPaymentTotalArs = paymentTotal ?? 0;

  const mpRef = useRef<MercadoPagoInstance | null>(null);
  const cardFormRef = useRef<CardFormInstance | null>(null);
  const savedSecurityCodeRef = useRef<SecureField | null>(null);
  const submittingRef = useRef(false);
  const saveCardForFutureRef = useRef(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadingCards, setLoadingCards] = useState(true);
  const [paymentMode, setPaymentMode] = useState<'loading' | 'saved' | 'new'>('loading');
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState('');
  const [saveCardForFuture, setSaveCardForFuture] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);

  useEffect(() => {
    saveCardForFutureRef.current = saveCardForFuture;
  }, [saveCardForFuture]);

  useEffect(() => {
    onPaymentBusyChange?.(loading);
  }, [loading, onPaymentBusyChange]);

  const selectedSavedCard =
    savedCards.find((card) => card.id === selectedSavedCardId) ?? savedCards[0] ?? null;
  const selectedSavedCardProviderId = selectedSavedCard?.cardId ?? null;

  const processOrder = useCallback(
    async ({
      token,
      paymentMethodId,
      issuerId,
      email,
      docType,
      docNumber,
      installments = 1,
      savedPaymentMethodId,
    }: ProcessOrderInput) => {
      const reservationResponse = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems,
          paymentMethod: 'mercadopago-card',
          checkoutKey: crypto.randomUUID(),
          shippingQuoteToken,
          ...(deliveryAddressId ? { deliveryAddressId } : {}),
        }),
      });
      const reservation = await reservationResponse.json();

      if (!reservationResponse.ok || !reservation.orderId) {
        throw new Error(
          reservation.error || reservation.message || 'No se pudo reservar el stock.',
        );
      }

      localStorage.setItem('last_pending_order_id', reservation.orderId);

      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: reservation.orderId,
          token,
          ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
          ...(issuerId ? { issuer_id: issuerId } : {}),
          description: 'Compra desde carrito',
          ...(email ? { email } : {}),
          ...(docType ? { docType } : {}),
          ...(docNumber ? { docNumber } : {}),
          installments,
          ...(savedPaymentMethodId ? { savedPaymentMethodId } : {}),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        const requestId = result.requestId ? ` (Mercado Pago requestId: ${result.requestId})` : '';
        const mpStatus = result.mercadoPagoStatus ? ` [MP HTTP ${result.mercadoPagoStatus}]` : '';
        const mpCode = result.mercadoPagoError ? ` [${result.mercadoPagoError}]` : '';
        const mpCauses =
          Array.isArray(result.mercadoPagoCauses) && result.mercadoPagoCauses.length
            ? ` ${JSON.stringify(result.mercadoPagoCauses)}`
            : '';
        throw new Error(
          `${result.message || result.error || 'No se pudo procesar el pago.'}${mpStatus}${mpCode}${mpCauses}${requestId}`,
        );
      }

      if (result.status !== 'approved' || result.status_detail !== 'accredited') {
        throw new Error(
          `Estado del pago: ${result.status || 'desconocido'} (${result.status_detail || 'sin detalle'})`,
        );
      }

      if (!result.orderId) {
        throw new Error('El pago fue aprobado pero no se confirmó la orden local.');
      }

      localStorage.removeItem('last_pending_order_id');
      finishCheckout();
      alert('¡Compra realizada con éxito!');
      router.replace('/historial');
    },
    [cartItems, deliveryAddressId, finishCheckout, router, shippingQuoteToken],
  );

  useEffect(() => {
    let cancelled = false;

    async function initializeCheckout() {
      // The provider returns only masked card details and opaque identifiers.
      try {
        const cardsResponse = await fetch('/api/payment-methods/mercadopago', {
          cache: 'no-store',
        });
        const cardsResult = (await cardsResponse.json().catch(() => ({}))) as {
          cards?: SavedCard[];
          error?: string;
        };

        if (!cancelled) {
          if (cardsResponse.ok && Array.isArray(cardsResult.cards)) {
            setSavedCards(cardsResult.cards);
            const firstCard = cardsResult.cards[0];
            setSelectedSavedCardId(firstCard?.id ?? '');
            setPaymentMode(firstCard ? 'saved' : 'new');
          } else {
            setSavedCards([]);
            setPaymentMode('new');
            if (cardsResponse.status !== 401 && cardsResult.error) {
              setInfoMessage(
                'No pudimos consultar las tarjetas guardadas; podés ingresar una nueva.',
              );
            }
          }
          setLoadingCards(false);
        }
      } catch {
        if (!cancelled) {
          setSavedCards([]);
          setPaymentMode('new');
          setLoadingCards(false);
          setInfoMessage('No pudimos consultar las tarjetas guardadas; podés ingresar una nueva.');
        }
      }

      try {
        const configResponse = await fetch('/api/mercadopago/client-config', {
          cache: 'no-store',
        });
        const config = (await configResponse.json()) as {
          publicKey?: string;
          mode?: 'split' | 'standalone';
          message?: string;
        };
        const publicKey = config.publicKey?.trim();
        if (!configResponse.ok || !publicKey) {
          throw new Error(
            config.message || 'Mercado Pago no tiene una clave pública válida para el checkout.',
          );
        }

        await loadMercadoPago();
        if (cancelled) return;

        const MercadoPago = (window as Window & { MercadoPago?: MercadoPagoConstructor })
          .MercadoPago;
        if (!MercadoPago) throw new Error('Mercado Pago no está disponible.');

        mpRef.current = new MercadoPago(publicKey, { locale: 'es-AR' });
        setSdkReady(true);
      } catch (error) {
        if (cancelled) return;
        setSdkError(error instanceof Error ? error.message : 'No se pudo iniciar Mercado Pago.');
      }
    }

    void initializeCheckout();

    return () => {
      cancelled = true;
      try {
        cardFormRef.current?.unmount?.();
        savedSecurityCodeRef.current?.unmount?.();
      } catch {
        // The iframe may already have been unmounted by the SDK.
      }
      cardFormRef.current = null;
      savedSecurityCodeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      paymentMode !== 'new' ||
      !sdkReady ||
      !mpRef.current ||
      cartItems.length === 0 ||
      cartTotal <= 0 ||
      !canQuoteArsTotal ||
      finalPaymentTotalArs <= 0
    ) {
      setReady(false);
      return;
    }

    let cancelled = false;
    const mp = mpRef.current;

    const cardForm = mp.cardForm({
      amount: finalPaymentTotalArs.toFixed(2),
      iframe: true,
      form: {
        id: 'form-checkout',
        cardNumber: { id: 'form-checkout__cardNumber', placeholder: 'Número de tarjeta' },
        expirationDate: { id: 'form-checkout__expirationDate', placeholder: 'MM/YY' },
        securityCode: { id: 'form-checkout__securityCode', placeholder: 'CVV' },
        cardholderName: { id: 'form-checkout__cardholderName', placeholder: 'Titular' },
        issuer: { id: 'form-checkout__issuer', placeholder: 'Banco emisor' },
        installments: { id: 'form-checkout__installments', placeholder: 'Cuotas' },
        identificationType: {
          id: 'form-checkout__identificationType',
          placeholder: 'Tipo de documento',
        },
        identificationNumber: {
          id: 'form-checkout__identificationNumber',
          placeholder: 'Número de documento',
        },
        cardholderEmail: { id: 'form-checkout__cardholderEmail', placeholder: 'Email' },
      },
      callbacks: {
        onFormMounted: (error: unknown) => {
          if (cancelled) return;
          if (error) {
            console.error('Mercado Pago CardForm mount error:', error);
            setErrorMessage('No se pudo inicializar el formulario de Mercado Pago.');
            return;
          }
          setReady(true);
        },
        onSubmit: async (event: Event) => {
          event.preventDefault();
          if (submittingRef.current) return;
          submittingRef.current = true;

          setLoading(true);
          setErrorMessage(null);
          setInfoMessage(null);

          try {
            const data = cardForm.getCardFormData();
            const token = String(data.token || '').trim();
            const paymentMethodId = String(data.paymentMethodId || '').trim();
            const issuerId = String(data.issuerId || '').trim();
            const email = String(data.cardholderEmail || '').trim();
            const identificationType = String(data.identificationType || '').trim();
            const identificationNumber = String(data.identificationNumber || '').trim();
            const installments = Number(data.installments || 1);

            if (
              !token ||
              !paymentMethodId ||
              !email ||
              !identificationType ||
              !identificationNumber
            ) {
              throw new Error(
                'Mercado Pago no pudo obtener todos los datos necesarios de la tarjeta.',
              );
            }

            if (saveCardForFutureRef.current) {
              const saveResponse = await fetch('/api/payment-methods/mercadopago', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
              });
              const savedResult = (await saveResponse.json()) as {
                card?: SavedCard;
                error?: string;
              };

              if (!saveResponse.ok || !savedResult.card) {
                throw new Error(
                  savedResult.error || 'No se pudo guardar la tarjeta para futuras compras.',
                );
              }

              setSavedCards((current) => [
                savedResult.card!,
                ...current.filter((card) => card.id !== savedResult.card!.id),
              ]);
              setSelectedSavedCardId(savedResult.card.id);
              setPaymentMode('saved');
              setSaveCardForFuture(false);
              setInfoMessage(
                'La tarjeta quedó guardada. Para autorizar esta compra, ingresá su CVV una vez más.',
              );
              return;
            }

            await processOrder({
              token,
              paymentMethodId,
              issuerId: issuerId || undefined,
              email,
              docType: identificationType,
              docNumber: identificationNumber,
              installments,
            });
          } catch (error) {
            console.error('Error procesando CardForm de Mercado Pago:', error);
            const message = error instanceof Error ? error.message : 'No se pudo procesar el pago.';
            setErrorMessage(message);
            alert(`Error: ${message}`);
          } finally {
            submittingRef.current = false;
            setLoading(false);
          }
        },
        onFetching: () => () => undefined,
      },
    });

    cardFormRef.current = cardForm;

    return () => {
      cancelled = true;
      setReady(false);
      try {
        cardForm.unmount?.();
      } catch {
        // Ignore a provider iframe that was already unmounted.
      }
      if (cardFormRef.current === cardForm) cardFormRef.current = null;
    };
  }, [
    paymentMode,
    sdkReady,
    cartItems,
    cartTotal,
    finalPaymentTotalArs,
    canQuoteArsTotal,
    processOrder,
    shippingQuoteToken,
  ]);

  useEffect(() => {
    if (paymentMode !== 'saved' || !sdkReady || !mpRef.current || !selectedSavedCardProviderId) {
      return;
    }

    let field: SecureField | null = null;
    try {
      field = mpRef.current.fields.create('securityCode', { placeholder: 'CVV' });
      field.mount('form-checkout__savedSecurityCode');
      savedSecurityCodeRef.current = field;
    } catch (error) {
      console.error('No se pudo montar el campo seguro de CVV de Mercado Pago.', {
        error: error instanceof Error ? error.name : 'UnknownError',
      });
    }

    return () => {
      try {
        field?.unmount?.();
      } catch {
        // Ignore if Mercado Pago already removed this field.
      }
      if (savedSecurityCodeRef.current === field) savedSecurityCodeRef.current = null;
    };
  }, [paymentMode, sdkReady, selectedSavedCardProviderId]);

  const fillTestBuyer = useCallback(() => {
    setNativeValue('form-checkout__cardholderName', 'APRO');
    setNativeValue('form-checkout__cardholderEmail', 'test@testuser.com');
    setNativeValue('form-checkout__identificationType', 'DNI');
    setNativeValue('form-checkout__identificationNumber', '12345678');
  }, []);

  const selectSavedCard = (card: SavedCard) => {
    setSelectedSavedCardId(card.id);
    setPaymentMode('saved');
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const handleSavedCardPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSavedCard || !mpRef.current || submittingRef.current) return;

    submittingRef.current = true;
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const cardToken = await mpRef.current.fields.createCardToken({
        cardId: selectedSavedCard.cardId,
      });
      const token = String(cardToken.id || '').trim();
      if (!token) {
        throw new Error('Mercado Pago no pudo tokenizar el código de seguridad.');
      }

      await processOrder({
        token,
        savedPaymentMethodId: selectedSavedCard.id,
        installments: 1,
      });
    } catch (error) {
      console.error('Error pagando con tarjeta guardada de Mercado Pago:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo procesar el pago con la tarjeta guardada.';
      setErrorMessage(message);
      alert(`Error: ${message}`);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const removeSelectedCard = async () => {
    if (!selectedSavedCard || loading) return;
    const confirmation = window.confirm(
      `¿Querés eliminar la tarjeta ${brandLabel(selectedSavedCard.brand)} ${cardLabel(selectedSavedCard)}?`,
    );
    if (!confirmation) return;

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const response = await fetch(
        `/api/payment-methods/mercadopago?id=${encodeURIComponent(selectedSavedCard.id)}`,
        { method: 'DELETE' },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo eliminar la tarjeta guardada.');
      }

      const remainingCards = savedCards.filter((card) => card.id !== selectedSavedCard.id);
      setSavedCards(remainingCards);
      setSelectedSavedCardId(remainingCards[0]?.id ?? '');
      setPaymentMode(remainingCards.length ? 'saved' : 'new');
      setInfoMessage('Se eliminó la tarjeta guardada.');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo eliminar la tarjeta guardada.',
      );
    } finally {
      setLoading(false);
    }
  };

  const renderSavedCardCarousel = () => (
    <section className="space-y-2" aria-label="Elegir método de pago">
      <p className="text-sm font-semibold text-foreground">
        ¿Querés pagar con una tarjeta que ya usaste?
      </p>
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3"
        aria-label="Tarjetas guardadas y nueva tarjeta"
      >
        {savedCards.map((card) => {
          const selected = paymentMode === 'saved' && selectedSavedCardId === card.id;
          return (
            <Button
              variant="ghost"
              size="sm"
              key={card.id}
              type="button"
              aria-pressed={selected}
              onClick={() => selectSavedCard(card)}
              className={`min-w-[238px] snap-start rounded-xl border p-4 text-left transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${selected ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border bg-card'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">{brandLabel(card.brand)}</span>
                {selected && (
                  <span className="text-xs font-semibold text-primary">Seleccionada</span>
                )}
              </span>
              <span className="mt-2 block text-sm text-foreground">
                {card.lastFourDigits ? `•••• ${card.lastFourDigits}` : 'Tarjeta guardada'}
              </span>
              {card.expirationMonth && card.expirationYear && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Vence {String(card.expirationMonth).padStart(2, '0')}/
                  {String(card.expirationYear).slice(-2)}
                </span>
              )}
            </Button>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          aria-pressed={paymentMode === 'new'}
          onClick={() => {
            setPaymentMode('new');
            setSaveCardForFuture(true);
            setErrorMessage(null);
            setInfoMessage(null);
          }}
          className={`flex min-w-[238px] snap-start flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center transition-colors hover:border-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${paymentMode === 'new' ? 'border-primary bg-accent' : 'border-border bg-card'}`}
        >
          <span className="text-2xl leading-none" aria-hidden="true">
            ＋
          </span>
          <span className="mt-2 font-semibold text-foreground">Agregar nueva tarjeta</span>
          <span className="mt-1 text-xs text-muted-foreground">
            Ingresar los datos de otra tarjeta
          </span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Deslizá horizontalmente para ver las otras opciones.
      </p>
    </section>
  );

  return (
    <div className="space-y-4">
      {loadingCards && (
        <p className="text-sm text-muted-foreground" role="status">
          Consultando tarjetas guardadas…
        </p>
      )}

      {!loadingCards && savedCards.length > 0 && renderSavedCardCarousel()}

      {infoMessage && (
        <p
          className="rounded-lg border border-primary/25 bg-accent p-3 text-sm text-primary"
          role="status"
        >
          {infoMessage}
        </p>
      )}

      {sdkError && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {sdkError}
        </p>
      )}

      {paymentMode === 'saved' && selectedSavedCard && (
        <form onSubmit={handleSavedCardPayment} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-foreground">
              Pagar con {brandLabel(selectedSavedCard.brand)} {cardLabel(selectedSavedCard)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Por seguridad, Mercado Pago solicita el código de seguridad en cada compra.
            </p>
            <label
              htmlFor="form-checkout__savedSecurityCode"
              className="mt-4 mb-1.5 block text-sm font-semibold text-foreground"
            >
              Código de seguridad (CVV)
            </label>
            <div
              id="form-checkout__savedSecurityCode"
              className="h-11 rounded-md border border-border bg-card px-3 py-2"
            />
          </div>

          {errorMessage && (
            <p
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          <Button
            type="submit"
            variant="mercadopago"
            size="lg"
            disabled={!sdkReady || loading || !selectedSavedCard}
            className="w-full"
          >
            {loading ? 'Procesando…' : 'Pagar con tarjeta guardada'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={removeSelectedCard}
            disabled={loading}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Eliminar esta tarjeta guardada
          </Button>
        </form>
      )}

      {paymentMode === 'new' && (
        <>
          {process.env.NODE_ENV === 'development' && (
            <Button
              type="button"
              variant="warning"
              size="sm"
              onClick={fillTestBuyer}
              className="w-full"
            >
              Completar titular, email y DNI de prueba
            </Button>
          )}

          <form id="form-checkout" className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="form-checkout__cardNumber"
                className="mb-1.5 block text-sm font-semibold text-foreground"
              >
                Número de tarjeta
              </label>
              <div
                id="form-checkout__cardNumber"
                className="h-11 rounded-md border border-border bg-card px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="form-checkout__cardholderName"
                className="mb-1.5 block text-sm font-semibold text-foreground"
              >
                Nombre del titular
              </label>
              <Input
                id="form-checkout__cardholderName"
                type="text"
                autoComplete="cc-name"
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="form-checkout__expirationDate"
                  className="mb-1.5 block text-sm font-semibold text-foreground"
                >
                  Vencimiento
                </label>
                <div
                  id="form-checkout__expirationDate"
                  className="h-11 rounded-md border border-border bg-card px-3 py-2"
                />
              </div>
              <div>
                <label
                  htmlFor="form-checkout__securityCode"
                  className="mb-1.5 block text-sm font-semibold text-foreground"
                >
                  CVV
                </label>
                <div
                  id="form-checkout__securityCode"
                  className="h-11 rounded-md border border-border bg-card px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="form-checkout__issuer"
                  className="mb-1.5 block text-sm font-semibold text-foreground"
                >
                  Banco emisor
                </label>
                <Select
                  id="form-checkout__issuer"
                  className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground"
                />
              </div>
              <div>
                <label
                  htmlFor="form-checkout__installments"
                  className="mb-1.5 block text-sm font-semibold text-foreground"
                >
                  Cuotas
                </label>
                <Select
                  id="form-checkout__installments"
                  className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="form-checkout__cardholderEmail"
                className="mb-1.5 block text-sm font-semibold text-foreground"
              >
                Email
              </label>
              <Input
                id="form-checkout__cardholderEmail"
                type="email"
                autoComplete="email"
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground"
              />
            </div>

            <div className="grid grid-cols-[35%_65%] gap-3">
              <div>
                <label
                  htmlFor="form-checkout__identificationType"
                  className="mb-1.5 block text-sm font-semibold text-foreground"
                >
                  Tipo de documento
                </label>
                <Select
                  id="form-checkout__identificationType"
                  className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground"
                />
              </div>
              <div>
                <label
                  htmlFor="form-checkout__identificationNumber"
                  className="mb-1.5 block text-sm font-semibold text-foreground"
                >
                  Número de documento
                </label>
                <Input
                  id="form-checkout__identificationNumber"
                  type="text"
                  autoComplete="off"
                  className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm text-foreground">
              <Checkbox
                type="checkbox"
                checked={saveCardForFuture}
                onChange={(event) => setSaveCardForFuture(event.currentTarget.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
              />
              <span>
                <span className="block font-semibold">
                  Guardar esta tarjeta para futuras compras
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Guardamos la referencia segura en Mercado Pago, no el número completo ni el CVV.
                  Para esta primera compra, te pediremos el CVV otra vez.
                </span>
              </span>
            </label>

            {errorMessage && (
              <p
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <Button
              id="form-checkout__submit"
              type="submit"
              variant="mercadopago"
              size="lg"
              disabled={!sdkReady || !ready || loading || cartItems.length === 0}
              className="mt-2 w-full"
            >
              {loading
                ? 'Procesando…'
                : saveCardForFuture
                  ? 'Guardar tarjeta y continuar'
                  : ready
                    ? 'Realizar compra'
                    : 'Cargando Mercado Pago…'}
            </Button>
          </form>
        </>
      )}

      {paymentMode === 'loading' && (
        <p role="status" className="text-sm text-muted-foreground">
          Preparando el método de pago…
        </p>
      )}
    </div>
  );
}
