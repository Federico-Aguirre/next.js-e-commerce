'use client';

import Script from 'next/script';
import { useCallback, useEffect, useState } from 'react';
import PayPalCardFields from '@/components/checkout/paypal/PayPalCardFields';
import type {
  PayPalCardSession,
  PayPalSDK,
  SavedPayPalCard,
} from '@/components/checkout/paypal/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

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

type Props = {
  onSuccess: () => void;
  existingAttemptId?: string | null;
  existingSavedPaymentMethodId?: string | null;
};
type BillingConfig = {
  clientId: string;
  clientToken: string;
  amountARS: number;
  amountUSD: number;
  exchangeRate: number;
};

export default function ProPlanPayPalPayment({
  onSuccess,
  existingAttemptId = null,
  existingSavedPaymentMethodId = null,
}: Props) {
  const [cards, setCards] = useState<SavedPayPalCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState('new');
  const [saveCard, setSaveCard] = useState(true);
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [session, setSession] = useState<PayPalCardSession | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/api/dashboard/pro-payment/cards?provider=PAYPAL', { cache: 'no-store' })
      .then(async (response) => (response.ok ? response.json() : { cards: [] }))
      .then((data: { cards?: SavedPayPalCard[] }) => {
        if (!active) return;
        const loaded = Array.isArray(data.cards) ? data.cards : [];
        setCards(loaded);
        setSelectedCard(
          existingAttemptId
            ? existingSavedPaymentMethodId &&
              loaded.some((card) => card.id === existingSavedPaymentMethodId)
              ? existingSavedPaymentMethodId
              : 'new'
            : (loaded[0]?.id ?? 'new'),
        );
      })
      .catch(() => {
        if (active) setSelectedCard('new');
      })
      .finally(() => {
        if (active) setCardsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [existingAttemptId, existingSavedPaymentMethodId]);

  useEffect(() => {
    if (!sdkLoaded || selectedCard !== 'new' || !window.paypal || session) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/dashboard/pro-payment/paypal', { cache: 'no-store' });
        const data = (await response.json()) as BillingConfig & { error?: string };
        if (!response.ok || !data.clientToken)
          throw new Error(data.error || 'PayPal no está disponible.');
        if (!active) return;
        setConfig(data);
        const sdk = await window.paypal!.createInstance({
          clientToken: data.clientToken,
          components: ['card-fields'],
          pageType: 'checkout',
        });
        const eligibility = await sdk.findEligibleMethods({ currencyCode: 'USD' });
        if (!eligibility.isEligible('advanced_cards')) {
          throw new Error('PayPal no habilitó campos de tarjeta para esta cuenta sandbox.');
        }
        if (active) setSession(sdk.createCardFieldsOneTimePaymentSession());
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'No se pudo iniciar PayPal.');
      }
    })();
    return () => {
      active = false;
    };
  }, [sdkLoaded, selectedCard, session]);

  const onFieldsError = useCallback((message: string) => setError(message), []);
  const onFieldsReady = useCallback(() => setError(null), []);

  async function pay() {
    if (loading || cardsLoading) return;
    const isSaved = selectedCard !== 'new';
    if (!isSaved && !session) {
      setError('Esperá a que los campos seguros de PayPal terminen de cargar.');
      return;
    }
    setLoading(true);
    setError(null);
    const paymentAttemptId = existingAttemptId || crypto.randomUUID();
    try {
      const createResponse = await fetch('/api/dashboard/pro-payment/paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          paymentAttemptId,
          ...(isSaved
            ? { savedPaymentMethodId: selectedCard, savePaymentMethod: false }
            : { savePaymentMethod: saveCard }),
        }),
      });
      const order = (await createResponse.json()) as {
        error?: string;
        paypalOrderId?: string;
        amountUSD?: number;
      };
      if (!createResponse.ok || !order.paypalOrderId)
        throw new Error(order.error || 'No se pudo crear el pago PayPal.');

      let providerOrderId = order.paypalOrderId;
      if (!isSaved) {
        const submitted = await session!.submit(order.paypalOrderId, {
          billingAddress: { countryCode: 'AR' },
        });
        if (submitted.state !== 'succeeded') {
          throw new Error(
            submitted.data?.message || 'PayPal no completó el ingreso de la tarjeta.',
          );
        }
        providerOrderId = submitted.data?.orderId || order.paypalOrderId;
      }

      const captureResponse = await fetch('/api/dashboard/pro-payment/paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'capture',
          paymentAttemptId,
          paypalOrderId: providerOrderId,
        }),
      });
      const result = (await captureResponse.json()) as {
        error?: string;
        success?: boolean;
        activated?: boolean;
      };
      if (!captureResponse.ok || !result.success || !result.activated) {
        throw new Error(result.error || 'PayPal no pudo confirmar el abono Pro.');
      }
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo procesar el pago PayPal.');
    } finally {
      setLoading(false);
    }
  }

  const selectedSavedCard = cards.find((card) => card.id === selectedCard);
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        La cuota del plan es ARS 75.000. PayPal procesa este pago en USD; vas a ver el equivalente y
        la cotización de referencia antes de pagar.
      </p>
      {cardsLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Consultando tarjetas guardadas…
        </p>
      ) : null}
      {!cardsLoading && cards.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Elegí una tarjeta</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                aria-pressed={selectedCard === card.id}
                onClick={() => {
                  setSelectedCard(card.id);
                  setSession(null);
                  setError(null);
                }}
                className={`rounded-xl border p-3 text-left text-sm ${selectedCard === card.id ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border'}`}
              >
                <span className="block font-semibold">
                  {card.brand} ···· {card.lastFourDigits || '----'}
                </span>
                {card.expirationMonth && card.expirationYear && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Vence {String(card.expirationMonth).padStart(2, '0')}/{card.expirationYear}
                  </span>
                )}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={selectedCard === 'new'}
              onClick={() => {
                setSelectedCard('new');
                setSession(null);
                setError(null);
              }}
              className={`rounded-xl border border-dashed p-3 text-left text-sm ${selectedCard === 'new' ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border'}`}
            >
              <span className="block font-semibold">＋ Agregar nueva tarjeta</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Tarjeta segura mediante PayPal
              </span>
            </button>
          </div>
        </fieldset>
      )}

      {selectedCard === 'new' && (
        <>
          <Script
            src="https://www.sandbox.paypal.com/web-sdk/v6/core"
            strategy="afterInteractive"
            onLoad={() => setSdkLoaded(true)}
            onError={() => setError('No se pudo cargar el SDK de PayPal.')}
          />
          {session && (
            <PayPalCardFields session={session} onReady={onFieldsReady} onError={onFieldsError} />
          )}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={saveCard}
              onChange={(event) => setSaveCard(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block font-semibold">
                Guardar tarjeta para próximas renovaciones
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                PayPal guarda la tarjeta en su bóveda segura si el banco y la cuenta lo permiten.
              </span>
            </span>
          </label>
        </>
      )}

      {selectedSavedCard && (
        <p className="rounded-lg border p-3 text-sm">
          Pagarás con {selectedSavedCard.brand} terminada en{' '}
          {selectedSavedCard.lastFourDigits || '----'}.
        </p>
      )}
      {config && (
        <p className="text-sm font-semibold">
          Total PayPal:{' '}
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
            config.amountUSD,
          )}{' '}
          USD
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Button
        type="button"
        className="w-full"
        disabled={loading || cardsLoading || (selectedCard === 'new' && !session)}
        onClick={() => void pay()}
      >
        {loading
          ? 'Verificando el pago…'
          : config && selectedCard === 'new'
            ? `Pagar ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(config.amountUSD)} USD`
            : selectedCard === 'new'
              ? 'Cargar PayPal…'
              : 'Continuar con PayPal'}
      </Button>
    </div>
  );
}
