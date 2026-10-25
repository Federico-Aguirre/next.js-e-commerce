'use client';

import { loadMercadoPago } from '@mercadopago/sdk-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

type SavedCard = {
  id: string;
  cardId: string;
  paymentMethodId: string;
  brand: string;
  lastFourDigits: string | null;
  expirationMonth: number | null;
  expirationYear: number | null;
};

type CardFormData = {
  token?: string;
  paymentMethodId?: string;
  cardholderEmail?: string;
  identificationType?: string;
  identificationNumber?: string;
};
type CardFormInstance = { getCardFormData: () => CardFormData; unmount?: () => void };
type SecureField = { mount: (element: string | HTMLElement) => unknown; unmount?: () => void };
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

type Props = {
  publicKey: string;
  onSuccess: () => void;
  existingAttemptId?: string | null;
  existingSavedPaymentMethodId?: string | null;
};

export default function ProPlanMercadoPagoPayment({
  publicKey,
  onSuccess,
  existingAttemptId = null,
  existingSavedPaymentMethodId = null,
}: Props) {
  const mpRef = useRef<MercadoPagoInstance | null>(null);
  const cardFormRef = useRef<CardFormInstance | null>(null);
  const cvvFieldRef = useRef<SecureField | null>(null);
  const attemptRef = useRef<string | null>(existingAttemptId);
  const submittingRef = useRef(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState('new');
  const [saveCard, setSaveCard] = useState(true);
  const [formReady, setFormReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    const response = await fetch('/api/dashboard/pro-payment/cards?provider=MERCADOPAGO', {
      cache: 'no-store',
    });
    const data = (await response.json()) as { cards?: SavedCard[]; error?: string };
    if (!response.ok) throw new Error(data.error || 'No se pudieron consultar las tarjetas.');
    const loaded = Array.isArray(data.cards) ? data.cards : [];
    setCards(loaded);
    return loaded;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/dashboard/pro-payment/cards?provider=MERCADOPAGO', {
          cache: 'no-store',
        });
        const data = (await response.json()) as { cards?: SavedCard[]; error?: string };
        if (!response.ok) throw new Error(data.error || 'No se pudieron consultar las tarjetas.');
        const loaded = Array.isArray(data.cards) ? data.cards : [];
        if (!active) return;
        setCards(loaded);
        setSelectedCard(
          existingAttemptId
            ? existingSavedPaymentMethodId &&
              loaded.some((card) => card.id === existingSavedPaymentMethodId)
              ? existingSavedPaymentMethodId
              : 'new'
            : (loaded[0]?.id ?? 'new'),
        );
      } catch {
        if (active) {
          setCards([]);
          setSelectedCard('new');
        }
      } finally {
        if (active) setCardsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [existingAttemptId, existingSavedPaymentMethodId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadMercadoPago();
        if (!active) return;
        const Constructor = (window as Window & { MercadoPago?: MercadoPagoConstructor })
          .MercadoPago;
        if (!Constructor) throw new Error('Mercado Pago no está disponible en el navegador.');
        mpRef.current = new Constructor(publicKey, { locale: 'es-AR' });
        setSdkReady(true);
      } catch (cause) {
        if (active)
          setError(cause instanceof Error ? cause.message : 'No se pudo cargar Mercado Pago.');
      }
    })();
    return () => {
      active = false;
      try {
        cardFormRef.current?.unmount?.();
      } catch {}
      try {
        cvvFieldRef.current?.unmount?.();
      } catch {}
      cardFormRef.current = null;
      cvvFieldRef.current = null;
    };
  }, [publicKey]);

  const charge = useCallback(
    async (
      token: string,
      paymentMethodId: string,
      savedPaymentMethodId?: string,
      document?: { type?: string; number?: string; email?: string },
    ) => {
      const attemptId = attemptRef.current || crypto.randomUUID();
      attemptRef.current = attemptId;
      const response = await fetch('/api/dashboard/pro-payment/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'charge',
          paymentAttemptId: attemptId,
          token,
          paymentMethodId,
          ...(savedPaymentMethodId ? { savedPaymentMethodId } : {}),
          ...(document?.email ? { email: document.email } : {}),
          ...(document?.type && document.number
            ? { docType: document.type, docNumber: document.number }
            : {}),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        success?: boolean;
        activated?: boolean;
      };
      if (!response.ok || !result.success || !result.activated) {
        if (result.error !== 'MERCADOPAGO_PAYMENT_PENDING') attemptRef.current = null;
        throw new Error(result.error || 'Mercado Pago no pudo confirmar el abono Pro.');
      }
      attemptRef.current = null;
      onSuccess();
    },
    [onSuccess],
  );

  useEffect(() => {
    if (!sdkReady || !mpRef.current || selectedCard !== 'new' || cardsLoading) {
      setFormReady(false);
      return;
    }
    let active = true;
    const mp = mpRef.current;
    const form = mp.cardForm({
      amount: '75000.00',
      iframe: true,
      form: {
        id: 'pro-form-checkout',
        cardNumber: { id: 'pro-checkout__cardNumber', placeholder: 'Número de tarjeta' },
        expirationDate: { id: 'pro-checkout__expirationDate', placeholder: 'MM/YY' },
        securityCode: { id: 'pro-checkout__securityCode', placeholder: 'CVV' },
        cardholderName: { id: 'pro-checkout__cardholderName', placeholder: 'Titular' },
        issuer: { id: 'pro-checkout__issuer', placeholder: 'Banco emisor' },
        installments: { id: 'pro-checkout__installments', placeholder: 'Cuotas' },
        identificationType: {
          id: 'pro-checkout__identificationType',
          placeholder: 'Tipo de documento',
        },
        identificationNumber: {
          id: 'pro-checkout__identificationNumber',
          placeholder: 'Número de documento',
        },
        cardholderEmail: { id: 'pro-checkout__cardholderEmail', placeholder: 'Email' },
      },
      callbacks: {
        onFormMounted: (mountError: unknown) => {
          if (!active) return;
          if (mountError) setError('No se pudo abrir el formulario seguro de Mercado Pago.');
          else setFormReady(true);
        },
        onSubmit: async (event: Event) => {
          event.preventDefault();
          if (submittingRef.current) return;
          submittingRef.current = true;
          setLoading(true);
          setError(null);
          setInfo(null);
          try {
            const data = form.getCardFormData();
            const token = String(data.token || '').trim();
            const paymentMethodId = String(data.paymentMethodId || '').trim();
            if (!token || !paymentMethodId)
              throw new Error('Mercado Pago no devolvió los datos de tarjeta necesarios.');
            if (saveCard) {
              const saveResponse = await fetch('/api/dashboard/pro-payment/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: 'MERCADOPAGO', token }),
              });
              const saved = (await saveResponse.json()) as { card?: SavedCard; error?: string };
              if (!saveResponse.ok || !saved.card)
                throw new Error(saved.error || 'No se pudo guardar la tarjeta.');
              const updated = await loadCards();
              setCards(updated);
              setSelectedCard(saved.card.id);
              setSaveCard(false);
              setInfo(
                'La tarjeta quedó guardada. Ingresá el CVV otra vez para autorizar el abono.',
              );
              return;
            }
            await charge(token, paymentMethodId, undefined, {
              type: String(data.identificationType || ''),
              number: String(data.identificationNumber || ''),
              email: String(data.cardholderEmail || ''),
            });
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'No se pudo procesar el pago.');
          } finally {
            submittingRef.current = false;
            setLoading(false);
          }
        },
        onFetching: () => () => undefined,
      },
    });
    cardFormRef.current = form;
    return () => {
      active = false;
      setFormReady(false);
      try {
        form.unmount?.();
      } catch {}
      if (cardFormRef.current === form) cardFormRef.current = null;
    };
  }, [sdkReady, selectedCard, cardsLoading, saveCard, charge, loadCards]);

  useEffect(() => {
    const card = cards.find((item) => item.id === selectedCard);
    if (!sdkReady || selectedCard === 'new' || !card || !mpRef.current) return;
    let field: SecureField | null = null;
    try {
      field = mpRef.current.fields.create('securityCode', { placeholder: 'CVV' });
      field.mount('pro-checkout__savedSecurityCode');
      cvvFieldRef.current = field;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo abrir el CVV seguro.';
      void Promise.resolve().then(() => setError(message));
    }
    return () => {
      try {
        field?.unmount?.();
      } catch {}
      if (cvvFieldRef.current === field) cvvFieldRef.current = null;
    };
  }, [sdkReady, selectedCard, cards]);

  const saved = cards.find((item) => item.id === selectedCard);

  async function paySavedCard() {
    if (!saved || !mpRef.current || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await mpRef.current.fields.createCardToken({ cardId: saved.cardId });
      const token = String(result.id || '').trim();
      if (!token) throw new Error('Mercado Pago no pudo tokenizar el CVV.');
      await charge(token, saved.paymentMethodId, saved.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo procesar el pago.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cuota inicial: ARS 75.000. El pago se confirma con Mercado Pago Sandbox.
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
                type="button"
                key={card.id}
                aria-pressed={selectedCard === card.id}
                onClick={() => {
                  setSelectedCard(card.id);
                  setInfo(null);
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
                setInfo(null);
                setError(null);
              }}
              className={`rounded-xl border border-dashed p-3 text-left text-sm ${selectedCard === 'new' ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border'}`}
            >
              <span className="block font-semibold">＋ Agregar nueva tarjeta</span>
            </button>
          </div>
        </fieldset>
      )}

      {selectedCard === 'new' && (
        <form
          id="pro-form-checkout"
          onSubmit={(event) => event.preventDefault()}
          className="space-y-3"
        >
          <label className="block space-y-1 text-sm">
            <span>Número de tarjeta</span>
            <div id="pro-checkout__cardNumber" className="rounded-lg border bg-card p-3" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <span>Vencimiento</span>
              <div id="pro-checkout__expirationDate" className="rounded-lg border bg-card p-3" />
            </label>
            <label className="block space-y-1 text-sm">
              <span>CVV</span>
              <div id="pro-checkout__securityCode" className="rounded-lg border bg-card p-3" />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span>Titular</span>
            <input
              id="pro-checkout__cardholderName"
              className="w-full rounded-lg border bg-card p-3"
              autoComplete="cc-name"
            />
          </label>
          <input id="pro-checkout__issuer" className="hidden" />
          <input id="pro-checkout__installments" type="hidden" value="1" readOnly />
          <label className="block space-y-1 text-sm">
            <span>Tipo de documento</span>
            <select
              id="pro-checkout__identificationType"
              className="w-full rounded-lg border bg-card p-3"
            >
              <option value="DNI">DNI</option>
              <option value="CUIT">CUIT</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Número de documento</span>
            <input
              id="pro-checkout__identificationNumber"
              className="w-full rounded-lg border bg-card p-3"
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Email</span>
            <input
              id="pro-checkout__cardholderEmail"
              type="email"
              className="w-full rounded-lg border bg-card p-3"
              autoComplete="email"
            />
          </label>
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
                La tarjeta se guarda en la bóveda sandbox de la cuenta receptora.
              </span>
            </span>
          </label>
        </form>
      )}

      {saved && (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <p className="font-semibold">
            {saved.brand} terminada en {saved.lastFourDigits || '----'}
          </p>
          <label className="block space-y-1">
            <span>CVV</span>
            <div id="pro-checkout__savedSecurityCode" className="rounded-lg border bg-card p-3" />
          </label>
        </div>
      )}

      {info && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {info}
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
      {selectedCard === 'new' ? (
        <Button
          type="submit"
          form="pro-form-checkout"
          className="w-full"
          disabled={loading || cardsLoading || !formReady}
        >
          {loading
            ? 'Procesando…'
            : saveCard
              ? 'Guardar tarjeta para el plan Pro'
              : 'Pagar ARS 75.000'}
        </Button>
      ) : (
        <Button
          type="button"
          className="w-full"
          disabled={loading || cardsLoading || !sdkReady}
          onClick={() => void paySavedCard()}
        >
          {loading ? 'Verificando el pago…' : 'Pagar ARS 75.000'}
        </Button>
      )}
    </div>
  );
}
