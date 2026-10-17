'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthRequiredNotice } from '@/components/checkout/AuthRequiredNotice';
import { useCartStore } from '@/store/useCartStore';

export default function CartPage() {
  // Carrito REAL de Zustand
  const cartItems = useCartStore((state) => state.cart);
  const clearCart = useCartStore((state) => state.clearCart);

  const { data: session } = useSession();
  const [showAuthNotice, setShowAuthNotice] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<{
    mercadoPago: boolean;
    paypal: boolean;
    stripe: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/payment-methods/status', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo verificar los medios de pago.');
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setPaymentMethods({
          mercadoPago: data.mercadoPago === true,
          paypal: data.paypal === true,
          stripe: data.stripe === true,
        });
      })
      .catch(() => {
        if (active) setPaymentMethods({ mercadoPago: false, paypal: false, stripe: false });
      });
    return () => {
      active = false;
    };
  }, []);
  const cartTotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-black text-gray-900">Your Shopping Cart</h1>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* LEFT SIDE: ITEMS */}
          <div className="space-y-4 md:col-span-2">
            {cartItems.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                <p className="font-medium text-gray-500">Your cart is currently empty.</p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={`${item.articleId}-${item.size}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="relative h-20 w-20 flex-shrink-0 rounded-xl border border-gray-100 bg-gray-50 p-2">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="h-full w-full object-contain mix-blend-multiply"
                        />
                      ) : (
                        <div className="h-full w-full rounded-lg bg-gray-200" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="line-clamp-1 text-sm font-bold text-gray-900">{item.title}</h4>

                      <p className="mt-1 text-xs text-gray-400">Quantity: {item.quantity}</p>

                      <p className="text-xs text-gray-400">Size: {item.size}</p>

                      <p className="text-xs text-gray-400">Color: {item.colorName}</p>

                      <p className="mt-1 text-xs text-gray-500">${item.price.toFixed(2)} each</p>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    <p className="text-sm font-black text-gray-950">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        useCartStore.getState().removeFromCart(item.articleId, item.size)
                      }
                      className="text-xs font-semibold text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}

            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-sm font-semibold text-red-500 hover:text-red-700"
              >
                Clear cart
              </button>
            )}
          </div>

          {/* RIGHT SIDE: ORDER SUMMARY */}
          <div className="h-fit rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-black text-gray-900">Order Summary</h3>

            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
              <span className="text-sm font-medium text-gray-500">Total Amount:</span>

              <span className="text-xl font-black text-gray-950">${cartTotal.toFixed(2)}</span>
            </div>

            <div className="space-y-3">
              {showAuthNotice && <AuthRequiredNotice />}
              {paymentMethods === null && (
                <p className="text-xs font-medium text-gray-500">Verificando medios de pago...</p>
              )}
              <Link
                href="/checkout/paypal"
                onClick={(event) => {
                  if (!session?.user || paymentMethods?.paypal !== true) {
                    event.preventDefault();
                    if (!session?.user) setShowAuthNotice(true);
                  }
                }}
                className={`flex h-12 w-full items-center justify-center rounded-lg bg-[#0070ba] text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#005ea8] ${
                  cartItems.length === 0 || paymentMethods?.paypal !== true
                    ? 'pointer-events-none opacity-50'
                    : ''
                }`}
              >
                {paymentMethods?.paypal === false ? 'PayPal no conectado' : 'Pay with PayPal'}
              </Link>

              {/* STRIPE */}
              <Link
                href="/checkout/stripe"
                onClick={(event) => {
                  if (!session?.user || paymentMethods?.stripe !== true) {
                    event.preventDefault();
                    if (!session?.user) setShowAuthNotice(true);
                  }
                }}
                className={`flex h-12 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 ${
                  cartItems.length === 0 || paymentMethods?.stripe !== true
                    ? 'pointer-events-none opacity-50'
                    : ''
                }`}
              >
                {paymentMethods?.stripe === false ? 'Stripe no conectado' : 'Pay with Stripe'}
              </Link>

              {/* MERCADO PAGO */}
              <Link
                href="/checkout"
                onClick={(event) => {
                  if (!session?.user || paymentMethods?.mercadoPago !== true) {
                    event.preventDefault();
                    if (!session?.user) setShowAuthNotice(true);
                  }
                }}
                className={`flex h-12 w-full items-center justify-center rounded-lg bg-sky-500 text-sm font-bold text-white shadow-sm transition-colors hover:bg-sky-600 ${
                  cartItems.length === 0 || paymentMethods?.mercadoPago !== true
                    ? 'pointer-events-none opacity-50'
                    : ''
                }`}
              >
                {paymentMethods?.mercadoPago === false
                  ? 'Mercado Pago no conectado'
                  : 'Pagar con Mercado Pago'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
