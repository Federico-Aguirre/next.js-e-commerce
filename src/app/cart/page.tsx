'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';

import { AuthRequiredNotice } from '@/components/checkout/AuthRequiredNotice';
import { useCartStore } from '@/store/useCartStore';

export default function CartPage() {
  // Carrito REAL de Zustand
  const cartItems = useCartStore((state) => state.cart);
  const clearCart = useCartStore((state) => state.clearCart);

  const { data: session } = useSession();
  const [showAuthNotice, setShowAuthNotice] = useState(false);
  const cartTotal = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black text-gray-900 mb-8">
          Your Shopping Cart
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* LEFT SIDE: ITEMS */}
          <div className="md:col-span-2 space-y-4">
            {cartItems.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center shadow-sm">
                <p className="text-gray-500 font-medium">
                  Your cart is currently empty.
                </p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={`${item.articleId}-${item.size}`}
                  className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative w-20 h-20 bg-gray-50 rounded-xl p-2 border border-gray-100 flex-shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-contain mix-blend-multiply"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 rounded-lg" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 line-clamp-1">
                        {item.title}
                      </h4>

                      <p className="text-xs text-gray-400 mt-1">
                        Quantity: {item.quantity}
                      </p>

                      <p className="text-xs text-gray-400">Size: {item.size}</p>

                      <p className="text-xs text-gray-400">
                        Color: {item.colorName}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        ${item.price.toFixed(2)} each
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="text-sm font-black text-gray-950">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        useCartStore
                          .getState()
                          .removeFromCart(item.articleId, item.size)
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
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
            <h3 className="text-lg font-black text-gray-900 mb-4">
              Order Summary
            </h3>

            <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
              <span className="text-sm font-medium text-gray-500">
                Total Amount:
              </span>

              <span className="text-xl font-black text-gray-950">
                ${cartTotal.toFixed(2)}
              </span>
            </div>

            <div className="space-y-3">
              {showAuthNotice && <AuthRequiredNotice />}
              <Link
                href="/checkout/paypal"
                onClick={(event) => {
                  if (!session?.user) {
                    event.preventDefault();
                    setShowAuthNotice(true);
                  }
                }}
                className={`w-full h-12 flex items-center justify-center bg-[#0070ba] hover:bg-[#005ea8] text-white font-bold text-sm rounded-lg shadow-sm transition-colors ${
                  cartItems.length === 0 ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                Pay with PayPal
              </Link>

              {/* STRIPE */}
              <Link
                href="/checkout/stripe"
                onClick={(event) => {
                  if (!session?.user) {
                    event.preventDefault();
                    setShowAuthNotice(true);
                  }
                }}
                className={`w-full h-12 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg shadow-sm transition-colors ${
                  cartItems.length === 0 ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                Pay with Stripe
              </Link>

              {/* MERCADO PAGO */}
              <Link
                href="/checkout"
                onClick={(event) => {
                  if (!session?.user) {
                    event.preventDefault();
                    setShowAuthNotice(true);
                  }
                }}
                className={`w-full h-12 flex items-center justify-center bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm rounded-lg shadow-sm transition-colors ${
                  cartItems.length === 0 ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                Pagar con Mercado Pago
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
