'use client';

import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_DEVELOPER_STRIPE_PUBLISHABLE_KEY || '');
const fieldOptions = {
  style: {
    base: { color: '#1f2937', fontSize: '14px', '::placeholder': { color: '#9ca3af' } },
    invalid: { color: '#dc2626' },
  },
};

type SavedCard = {
  id: string;
  brand: string;
  lastFourDigits: string | null;
  expirationMonth: number | null;
  expirationYear: number | null;
};

type Props = {
  onSuccess: () => void;
  existingAttemptId?: string | null;
  existingSavedPaymentMethodId?: string | null;
};

export default function ProPlanStripePayment({
  onSuccess,
  existingAttemptId = null,
  existingSavedPaymentMethodId = null,
}: Props) {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState('new');
  const [saveCard, setSaveCard] = useState(true);
  const [paymentAttemptId, setPaymentAttemptId] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [useSavedCardForIntent, setUseSavedCardForIntent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/api/dashboard/pro-payment/cards?provider=STRIPE', { cache: 'no-store' })
      .then(async (response) => (response.ok ? response.json() : { cards: [] }))
      .then((data: { cards?: SavedCard[] }) => {
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
        if (active) {
          setCards([]);
          setSelectedCard('new');
        }
      })
      .finally(() => {
        if (active) setCardsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [existingAttemptId, existingSavedPaymentMethodId]);

  async function preparePayment() {
    setLoading(true);
    setError(null);
    const attemptId = paymentAttemptId || existingAttemptId || crypto.randomUUID();
    try {
      const response = await fetch('/api/dashboard/pro-payment/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare',
          paymentAttemptId: attemptId,
          ...(selectedCard !== 'new'
            ? { savedPaymentMethodId: selectedCard, savePaymentMethod: false }
            : { savePaymentMethod: saveCard }),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        clientSecret?: string;
        paymentIntentId?: string;
        alreadyPaid?: boolean;
        activated?: boolean;
        useSavedCard?: boolean;
      };
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar el pago de Stripe.');
      if (data.alreadyPaid && data.activated) {
        onSuccess();
        return;
      }
      if (!data.clientSecret || !data.paymentIntentId)
        throw new Error('Stripe no devolvió los datos necesarios para pagar.');
      setPaymentAttemptId(attemptId);
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setUseSavedCardForIntent(Boolean(data.useSavedCard));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar el pago de Stripe.');
    } finally {
      setLoading(false);
    }
  }

  if (clientSecret && paymentIntentId && paymentAttemptId) {
    return (
      <Elements stripe={stripePromise} key={paymentAttemptId}>
        <StripeProConfirmation
          clientSecret={clientSecret}
          paymentIntentId={paymentIntentId}
          paymentAttemptId={paymentAttemptId}
          useSavedCard={useSavedCardForIntent}
          onSuccess={onSuccess}
          onCancel={async () => {
            setLoading(true);
            try {
              const response = await fetch('/api/dashboard/pro-payment/stripe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel', paymentAttemptId, paymentIntentId }),
              });
              const data = (await response.json()) as {
                error?: string;
                alreadyPaid?: boolean;
                activated?: boolean;
              };
              if (data.alreadyPaid && data.activated) {
                onSuccess();
                return;
              }
              if (!response.ok)
                throw new Error(data.error || 'No se pudo cancelar el intento de pago.');
              setClientSecret(null);
              setPaymentIntentId(null);
              setPaymentAttemptId(null);
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : 'No se pudo cancelar el intento de pago.',
              );
            } finally {
              setLoading(false);
            }
          }}
        />
      </Elements>
    );
  }

  return (
    <div className="space-y-4">
      {cardsLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Consultando tarjetas guardadas…
        </p>
      ) : null}
      {!cardsLoading && cards.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Elegí una tarjeta guardada</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                aria-pressed={selectedCard === card.id}
                onClick={() => {
                  setSelectedCard(card.id);
                  setPaymentAttemptId(null);
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
                setPaymentAttemptId(null);
                setError(null);
              }}
              className={`rounded-xl border border-dashed p-3 text-left text-sm ${selectedCard === 'new' ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border'}`}
            >
              <span className="block font-semibold">＋ Agregar nueva tarjeta</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Ingresar otros datos de tarjeta
              </span>
            </button>
          </div>
        </fieldset>
      )}
      {selectedCard === 'new' && !cardsLoading && (
        <>
          <p className="text-sm text-muted-foreground">
            Vas a pagar ARS 75.000 mediante Stripe en modo de prueba.
          </p>
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
                Stripe almacena la tarjeta en su bóveda segura. Esta tienda no recibe el número
                completo ni el CVV.
              </span>
            </span>
          </label>
        </>
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
        disabled={loading || cardsLoading}
        onClick={() => void preparePayment()}
      >
        {loading ? 'Preparando el pago…' : 'Continuar al pago con Stripe'}
      </Button>
    </div>
  );
}

function StripeProConfirmation({
  clientSecret,
  paymentIntentId,
  paymentAttemptId,
  useSavedCard,
  onSuccess,
  onCancel,
}: {
  clientSecret: string;
  paymentIntentId: string;
  paymentAttemptId: string;
  useSavedCard: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);
    try {
      const cardNumber = useSavedCard ? null : elements.getElement(CardNumberElement);
      if (!useSavedCard && !cardNumber)
        throw new Error('Los campos de tarjeta todavía no están disponibles.');
      const result = useSavedCard
        ? await stripe.confirmCardPayment(clientSecret)
        : await stripe.confirmCardPayment(clientSecret, {
            payment_method: { card: cardNumber!, billing_details: {} },
          });
      if (result.error) throw new Error(result.error.message || 'Stripe no pudo procesar el pago.');
      if (result.paymentIntent?.status !== 'succeeded') {
        throw new Error(
          'Stripe todavía no confirmó el pago. Completá la verificación que solicite tu banco.',
        );
      }
      const response = await fetch('/api/dashboard/pro-payment/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', paymentAttemptId, paymentIntentId }),
      });
      const data = (await response.json()) as {
        error?: string;
        success?: boolean;
        activated?: boolean;
      };
      if (!response.ok || !data.success || !data.activated) {
        throw new Error(
          data.error || 'El pago no pudo activar el plan Pro. Revisá el estado desde el panel.',
        );
      }
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar el pago.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">Cuota inicial: ARS 75.000</p>
      {!useSavedCard && (
        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span>Número de tarjeta</span>
            <div className="rounded-lg border bg-card p-3">
              <CardNumberElement options={fieldOptions} />
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <span>Vencimiento</span>
              <div className="rounded-lg border bg-card p-3">
                <CardExpiryElement options={fieldOptions} />
              </div>
            </label>
            <label className="block space-y-1 text-sm">
              <span>CVV</span>
              <div className="rounded-lg border bg-card p-3">
                <CardCvcElement options={fieldOptions} />
              </div>
            </label>
          </div>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" type="button" disabled={loading} onClick={onCancel}>
          Volver
        </Button>
        <Button
          type="button"
          disabled={loading || !stripe || (!useSavedCard && !elements)}
          onClick={() => void pay()}
        >
          {loading ? 'Verificando el pago…' : 'Pagar ARS 75.000'}
        </Button>
      </div>
    </div>
  );
}
