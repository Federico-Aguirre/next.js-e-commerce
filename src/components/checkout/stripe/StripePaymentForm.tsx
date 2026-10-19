'use client';

import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { useState } from 'react';

type StripePaymentFormProps = {
  clientSecret: string;
  orderId: string;
  paymentIntentId: string;
  amount: number;
  onSuccess: () => void;
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

  const testData = {
    cardNumber: '4242 4242 4242 4242',
    expiration: '12/34',
    cvc: '123',
  };

  const copyToClipboard = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);

      setCopiedField(field);

      setTimeout(() => {
        setCopiedField(null);
      }, 1500);
    } catch (error) {
      console.error('No se pudo copiar el dato:', error);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      setErrorMessage('El campo del número de tarjeta no está disponible.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
        },
      });

      if (error) {
        setErrorMessage(error.message || 'No se pudo procesar el pago.');

        return;
      }

      const response = await fetch('/api/stripe/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId,
          orderId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'No se pudo confirmar la orden.');
      }

      onSuccess();
    } catch (error: unknown) {
      console.error('Error Stripe:', error);

      setErrorMessage(error instanceof Error ? error.message : 'Error al procesar el pago.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-5">
      {/* DATOS DE PRUEBA */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-indigo-900">Datos de prueba</h3>

          <p className="mt-1 text-xs text-indigo-600">
            Stripe está configurado en modo de prueba. Podés utilizar estos datos.
          </p>
        </div>

        <div className="space-y-2">
          {/* Número */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                Número de tarjeta
              </p>

              <p className="text-sm font-semibold tracking-wide text-gray-800">
                {testData.cardNumber}
              </p>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(testData.cardNumber, 'card')}
              className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-indigo-700"
            >
              {copiedField === 'card' ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>

          {/* Fecha */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-white px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                Fecha de caducidad
              </p>

              <p className="text-sm font-semibold text-gray-800">{testData.expiration}</p>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(testData.expiration, 'expiration')}
              className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-indigo-700"
            >
              {copiedField === 'expiration' ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>

          {/* CVC */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-white px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                Código de seguridad
              </p>

              <p className="text-sm font-semibold text-gray-800">{testData.cvc}</p>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(testData.cvc, 'cvc')}
              className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-indigo-700"
            >
              {copiedField === 'cvc' ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>

      {/* Stripe: solo campos de tarjeta, sin selector de otros medios de pago ni dirección de facturación. */}
      <div className="space-y-4">
        <p className="text-sm font-bold text-gray-800">Datos de tarjeta</p>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Número de tarjeta</label>
          <div className="rounded-lg border border-gray-300 bg-white px-3 py-3 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
            <CardNumberElement
              options={{
                placeholder: '4242 4242 4242 4242',
                style: {
                  base: {
                    color: '#1f2937',
                    fontSize: '14px',
                    '::placeholder': { color: '#9ca3af' },
                  },
                  invalid: { color: '#dc2626' },
                },
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Fecha de caducidad
            </label>
            <div className="rounded-lg border border-gray-300 bg-white px-3 py-3 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
              <CardExpiryElement
                options={{
                  placeholder: 'MM / YY',
                  style: {
                    base: {
                      color: '#1f2937',
                      fontSize: '14px',
                      '::placeholder': { color: '#9ca3af' },
                    },
                    invalid: { color: '#dc2626' },
                  },
                }}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Código de seguridad
            </label>
            <div className="rounded-lg border border-gray-300 bg-white px-3 py-3 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
              <CardCvcElement
                options={{
                  placeholder: 'CVC',
                  style: {
                    base: {
                      color: '#1f2937',
                      fontSize: '14px',
                      '::placeholder': { color: '#9ca3af' },
                    },
                    invalid: { color: '#dc2626' },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-600">{errorMessage}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !stripe || !elements}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? 'Procesando...'
          : `Pagar ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'code' }).format(amount)}`}
      </button>
    </form>
  );
}
