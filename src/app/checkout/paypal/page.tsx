'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import { AuthRequiredNotice } from '@/components/checkout/AuthRequiredNotice';
import PayPalCardForm from '@/components/checkout/paypal/PayPalCardForm';
import { useCartStore } from '@/store/useCartStore';

export default function PayPalCheckoutPage() {
  const { data: session, status } = useSession();
  const cartItems = useCartStore((state) => state.cart);

  const clearCart = useCartStore((state) => state.clearCart);

  const [completed, setCompleted] = useState(false);

  const cartTotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  const handleSuccess = useCallback(() => {
    setCompleted(true);

    clearCart();

    window.location.replace('/historial');
  }, [clearCart]);

  if (status === 'loading') {
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
            className="inline-flex rounded-lg bg-[#0070ba] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#005ea8]"
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
            <h1 className="text-xl font-bold text-gray-900">Pago con PayPal</h1>

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

          <PayPalCardForm
            amount={cartTotal}
            cartItems={cartItems}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
    </main>
  );
}
