'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AuthRequiredNotice } from '@/components/checkout/AuthRequiredNotice';
import StripePaymentForm from '@/components/checkout/stripe/StripePaymentForm';
import { useCartStore } from '@/store/useCartStore';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
);

type StripeCheckoutData = {
  clientSecret: string;
  paymentIntentId: string;
  orderId: string;
};

export default function StripeCheckoutPage() {
  const { data: session, status: sessionStatus } = useSession();
  const cartItems = useCartStore((state) => state.cart);

  const clearCart = useCartStore((state) => state.clearCart);

  const [stripeData, setStripeData] = useState<StripeCheckoutData | null>(null);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [completed, setCompleted] = useState(false);

  const cartTotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  useEffect(() => {
    if (
      sessionStatus !== 'authenticated' ||
      cartItems.length === 0 ||
      completed
    ) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function createStripePayment() {
      try {
        setLoading(true);
        setErrorMessage(null);

        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: cartItems,
            paymentMethod: 'stripe',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || 'No se pudo iniciar el pago con Stripe.',
          );
        }

        if (!data.clientSecret || !data.paymentIntentId || !data.orderId) {
          throw new Error('La respuesta de Stripe es inválida.');
        }

        if (!cancelled) {
          setStripeData({
            clientSecret: data.clientSecret,
            paymentIntentId: data.paymentIntentId,
            orderId: data.orderId,
          });
        }
      } catch (error: unknown) {
        console.error('Error iniciando Stripe:', error);

        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'No se pudo iniciar el pago.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    createStripePayment();

    return () => {
      cancelled = true;
    };
  }, [cartItems, completed, sessionStatus]);

  const handleSuccess = () => {
    setCompleted(true);

    sessionStorage.setItem('stripe_payment_success', 'true');

    alert('¡Compra realizada con éxito!');

    clearCart();

    window.location.replace('/historial');
  };

  if (sessionStatus === 'loading') {
    return <div className="p-8 text-center">Cargando...</div>;
  }

  if (!session?.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <AuthRequiredNotice />
      </main>
    );
  }

  if (cartItems.length === 0 && !completed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <p className="mb-4 text-lg font-bold text-gray-900">
            Tu carrito está vacío
          </p>

          <Link
            href="/cart"
            className="inline-flex rounded-lg bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
          >
            Volver al carrito
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h1 className="text-xl font-bold text-gray-900">Pago con Stripe</h1>

            <Link
              href="/cart"
              className="text-sm font-semibold text-gray-500 hover:text-gray-700"
            >
              ← Volver
            </Link>
          </div>

          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600">
                Total:
              </span>

              <span className="text-xl font-extrabold text-gray-900">
                ${cartTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {loading && (
            <div className="flex min-h-40 items-center justify-center">
              <p className="text-sm font-medium text-gray-500">
                Preparando el formulario de pago...
              </p>
            </div>
          )}

          {errorMessage && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">{errorMessage}</p>

              <Link
                href="/cart"
                className="mt-4 inline-block text-sm font-bold text-red-700 underline"
              >
                Volver al carrito
              </Link>
            </div>
          )}

          {stripeData && !loading && !errorMessage && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: stripeData.clientSecret,
              }}
            >
              <StripePaymentForm
                orderId={stripeData.orderId}
                paymentIntentId={stripeData.paymentIntentId}
                amount={cartTotal}
                onSuccess={handleSuccess}
              />
            </Elements>
          )}
        </div>
      </div>
    </main>
  );
}
