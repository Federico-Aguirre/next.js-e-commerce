'use client';

import {
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { useState } from 'react';

type StripePaymentFormProps = {
  orderId: string;
  paymentIntentId: string;
  amount: number;
  onSuccess: () => void;
};

export default function StripePaymentForm({
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
    country: 'Estados Unidos',
    postalCode: '94105',
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

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,

        confirmParams: {
          payment_method_data: {
            billing_details: {
              address: {
                country: 'US',
                postal_code: '94105',
                line1: '123 Market Street',
                city: 'San Francisco',
                state: 'CA',
              },
            },
          },
        },

        redirect: 'if_required',
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

      setErrorMessage(
        error instanceof Error ? error.message : 'Error al procesar el pago.',
      );
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
            Stripe está configurado en modo de prueba. Podés utilizar estos
            datos.
          </p>
        </div>

        <div className="space-y-2">
          {/* Número */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
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
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Fecha de caducidad
              </p>

              <p className="text-sm font-semibold text-gray-800">
                {testData.expiration}
              </p>
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
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Código de seguridad
              </p>

              <p className="text-sm font-semibold text-gray-800">
                {testData.cvc}
              </p>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(testData.cvc, 'cvc')}
              className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-indigo-700"
            >
              {copiedField === 'cvc' ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>

          {/* País */}
          <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-white px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                País
              </p>

              <p className="text-sm font-semibold text-gray-800">
                {testData.country}
              </p>
            </div>

            <span className="text-[11px] font-semibold text-indigo-500">
              Automático
            </span>
          </div>

          {/* Código postal */}
          <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-white px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Código postal
              </p>

              <p className="text-sm font-semibold text-gray-800">
                {testData.postalCode}
              </p>
            </div>

            <span className="text-[11px] font-semibold text-indigo-500">
              Automático
            </span>
          </div>
        </div>
      </div>

      {/* STRIPE */}
      <div>
        <p className="mb-2 text-sm font-bold text-gray-800">Datos de tarjeta</p>

        <PaymentElement
          options={{
            fields: {
              billingDetails: {
                address: 'never',
              },
            },
          }}
        />
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
        {loading ? 'Procesando...' : `Pagar $${amount.toFixed(2)}`}
      </button>
    </form>
  );
}
