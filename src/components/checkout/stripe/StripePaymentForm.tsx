'use client';

import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

type SavedStripeCard = {
  id: string;
  brand: string;
  lastFourDigits: string | null;
  expirationMonth: number | null;
  expirationYear: number | null;
};

type StripePaymentFormProps = {
  clientSecret: string;
  orderId: string;
  paymentIntentId: string;
  amount: number;
  onSuccess: () => void;
};

const fieldOptions = {
  style: {
    base: {
      color: '#1f2937',
      fontSize: '14px',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#dc2626' },
  },
};

export default function StripePaymentForm({
  clientSecret,
  orderId,
  paymentIntentId,
  amount,
  onSuccess,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<SavedStripeCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('new');
  const [saveCard, setSaveCard] = useState(true);

  const testData = {
    cardNumber: '4242 4242 4242 4242',
    expiration: '12/34',
    cvc: '123',
  };

  useEffect(() => {
    let active = true;
    void fetch('/api/payment-methods/stripe', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return { cards: [] as SavedStripeCard[] };
        const data = (await response.json()) as { cards?: SavedStripeCard[] };
        return { cards: Array.isArray(data.cards) ? data.cards : [] };
      })
      .then(({ cards }) => {
        if (!active) return;
        setSavedCards(cards);
        setSelectedPaymentMethod(cards[0]?.id ?? 'new');
      })
      .catch(() => {
        if (active) {
          setSavedCards([]);
          setSelectedPaymentMethod('new');
        }
      })
      .finally(() => {
        if (active) setCardsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const copyToClipboard = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch (error) {
      console.error('No se pudo copiar el dato:', error);
    }
  };

  async function preparePayment(body: {
    savePaymentMethod?: boolean;
    savedPaymentMethodId?: string;
  }) {
    const response = await fetch('/api/stripe/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentIntentId, orderId, ...body }),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) throw new Error(result.message || 'No se pudo preparar el pago.');
  }

  async function refreshSavedCards() {
    const response = await fetch('/api/payment-methods/stripe', { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { cards?: SavedStripeCard[] };
    if (Array.isArray(data.cards)) setSavedCards(data.cards);
  }

  const removeSavedCard = async (savedPaymentMethodId: string) => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const response = await fetch('/api/payment-methods/stripe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ savedPaymentMethodId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'No se pudo quitar la tarjeta.');
      const remaining = savedCards.filter((card) => card.id !== savedPaymentMethodId);
      setSavedCards(remaining);
      if (selectedPaymentMethod === savedPaymentMethodId) {
        setSelectedPaymentMethod(remaining[0]?.id ?? 'new');
        if (remaining.length === 0) setSaveCard(true);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo quitar la tarjeta.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || cardsLoading) return;

    const usingSavedCard = selectedPaymentMethod !== 'new';
    const cardNumberElement = usingSavedCard ? null : elements.getElement(CardNumberElement);
    if (!usingSavedCard && !cardNumberElement) {
      setErrorMessage('El campo del número de tarjeta no está disponible.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // This endpoint checks that the card and order belong to the logged-in user.
      // A new card is only attached to the Stripe Customer when the buyer opted in.
      await preparePayment(
        usingSavedCard
          ? { savedPaymentMethodId: selectedPaymentMethod }
          : { savePaymentMethod: saveCard },
      );

      const confirmation = usingSavedCard
        ? await stripe.confirmCardPayment(clientSecret)
        : await stripe.confirmCardPayment(clientSecret, {
            payment_method: { card: cardNumberElement! },
          });

      if (confirmation.error) {
        setErrorMessage(confirmation.error.message || 'No se pudo procesar el pago.');
        return;
      }
      if (confirmation.paymentIntent?.status !== 'succeeded') {
        setErrorMessage(
          'Stripe todavía no confirmó el pago. Revisá la autenticación solicitada por tu banco.',
        );
        return;
      }

      // If opted in, the server syncs the newly attached PaymentMethod after the successful payment.
      const response = await fetch('/api/stripe/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId, orderId }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || 'No se pudo confirmar la orden.');

      if (!usingSavedCard && saveCard) await refreshSavedCards();
      onSuccess();
    } catch (error: unknown) {
      console.error('Error Stripe:', error instanceof Error ? error.name : 'UnknownError');
      setErrorMessage(error instanceof Error ? error.message : 'Error al procesar el pago.');
    } finally {
      setLoading(false);
    }
  };

  const selectedSavedCard = savedCards.find((card) => card.id === selectedPaymentMethod);
  const selectedSavedCardDescription = selectedSavedCard
    ? `${selectedSavedCard.brand}${selectedSavedCard.lastFourDigits ? ` terminada en ${selectedSavedCard.lastFourDigits}` : ''}`
    : '';

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-5">
      {process.env.NODE_ENV === 'development' && (
        <div className="rounded-xl border border-stripe/20 bg-accent p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-primary">Datos de prueba</h3>
            <p className="mt-1 text-xs text-primary">
              Stripe está configurado en modo de prueba. Podés utilizar estos datos.
            </p>
          </div>
          <div className="space-y-2">
            {(
              [
                ['Número de tarjeta', testData.cardNumber, 'card'],
                ['Fecha de caducidad', testData.expiration, 'expiration'],
                ['Código de seguridad', testData.cvc, 'cvc'],
              ] as const
            ).map(([label, value, field]) => (
              <div
                key={field}
                className="flex items-center justify-between gap-3 rounded-lg border border-stripe/20 bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {label}
                  </p>
                  <p className="text-sm font-semibold tracking-wide text-foreground">{value}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => void copyToClipboard(value, field)}
                  className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground transition hover:bg-primary/90"
                >
                  {copiedField === field ? '✓ Copiado' : 'Copiar'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {cardsLoading ? (
        <div
          className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
          role="status"
        >
          Consultando tus tarjetas guardadas…
        </div>
      ) : savedCards.length > 0 ? (
        <section aria-label="Tarjetas guardadas" className="space-y-3">
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
                  className={`min-w-48 snap-start rounded-xl border p-3 ${selected ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border bg-card'}`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setSelectedPaymentMethod(card.id);
                      setSaveCard(false);
                    }}
                    aria-pressed={selected}
                    className="w-full text-left focus-visible:outline-2 focus-visible:outline-ring"
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
                      <span className="mt-2 block text-xs font-semibold text-primary">
                        Seleccionada
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={loading}
                    onClick={() => void removeSavedCard(card.id)}
                    className="mt-3 text-xs font-medium text-destructive underline decoration-dotted underline-offset-2 hover:text-destructive disabled:opacity-50"
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
              onClick={() => {
                setSelectedPaymentMethod('new');
                setSaveCard(true);
              }}
              aria-pressed={selectedPaymentMethod === 'new'}
              className={`min-w-48 snap-start rounded-xl border border-dashed p-4 text-left focus-visible:outline-2 focus-visible:outline-ring ${selectedPaymentMethod === 'new' ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border bg-muted/40 hover:border-primary'}`}
            >
              <span className="block text-lg font-semibold text-primary">＋</span>
              <span className="block text-sm font-bold text-foreground">Agregar nueva tarjeta</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Ingresar otros datos de tarjeta
              </span>
            </Button>
          </div>
        </section>
      ) : null}

      {selectedPaymentMethod === 'new' ? (
        <div className="space-y-4">
          <p className="text-sm font-bold text-foreground">Datos de tarjeta</p>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Número de tarjeta
            </label>
            <div className="rounded-lg border border-border bg-card px-3 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <CardNumberElement
                options={{ ...fieldOptions, placeholder: '4242 4242 4242 4242' }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Fecha de caducidad
              </label>
              <div className="rounded-lg border border-border bg-card px-3 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <CardExpiryElement options={{ ...fieldOptions, placeholder: 'MM / YY' }} />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Código de seguridad
              </label>
              <div className="rounded-lg border border-border bg-card px-3 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <CardCvcElement options={{ ...fieldOptions, placeholder: 'CVC' }} />
              </div>
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
            <Checkbox
              type="checkbox"
              checked={saveCard}
              onChange={(event) => setSaveCard(event.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="block font-semibold text-foreground">
                Guardar esta tarjeta para futuras compras
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Stripe la guardará de forma segura. No guardamos el número completo ni el código de
                seguridad en esta tienda.
              </span>
            </span>
          </label>
        </div>
      ) : selectedSavedCard ? (
        <div className="rounded-xl border border-stripe/20 bg-accent p-4">
          <p className="text-sm font-bold text-foreground">
            Vas a pagar con {selectedSavedCardDescription}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Stripe puede solicitar una verificación adicional según tu banco.
          </p>
        </div>
      ) : null}

      {errorMessage && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3" role="alert">
          <p className="text-sm font-medium text-destructive">{errorMessage}</p>
        </div>
      )}

      <Button
        type="submit"
        variant="stripe"
        size="lg"
        disabled={loading || cardsLoading || !stripe || !elements}
        className="w-full"
      >
        {loading
          ? 'Procesando...'
          : `Pagar ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', currencyDisplay: 'code' }).format(amount)}${selectedSavedCard ? ` con ${selectedSavedCard.brand}` : ''}`}
      </Button>
    </form>
  );
}
