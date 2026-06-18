'use client';

import React, { useState } from 'react';

// Strict type definition for international developers
interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
}

export default function CartPage() {
  // 1. STATE MANAGEMENT
  // Reemplazá este mockState por tu hook real de carrito (ej. usando tu Context, Redux o Zustand)
  // Ej: const { cart, clearCart } = useCart();
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: "prod_1",
      title: "Senior Oversized Hoodie",
      price: 89.99,
      quantity: 1,
      image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=500"
    }
  ]);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // 2. CORE GATEWAY ROUTER (EXECUTION)
  const handleProcessPayment = async (event: React.MouseEvent<HTMLButtonElement>, paymentMethod: 'mercadopago' | 'stripe') => {
    // CRITICAL: Stop any form submission or page bubble mechanics completely
    event.preventDefault();
    event.stopPropagation();
    
    if (!cartItems || cartItems.length === 0) {
      setCheckoutError("Cannot process checkout. Your cart is empty.");
      return;
    }

    setIsProcessing(true);
    setCheckoutError(null);

    try {
      console.log("Sending payload to checkout API...", { items: cartItems, paymentMethod });

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          items: cartItems,
          paymentMethod: paymentMethod
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize external payment session.');
      }

      // SUCCESS: If the API returns the target gateway URL, execute immediate hardware location shift
      if (data.url) {
        console.log("Redirecting client to gateway environment:", data.url);
        window.location.href = data.url;
      } else {
        throw new Error("Invalid API response. Missing redirection URL pointer.");
      }

    } catch (error: unknown) {
      console.error("Redirection pipeline failed:", error);
      if (error instanceof Error) {
        setCheckoutError(error.message);
      } else {
        setCheckoutError('An unexpected networking error occurred.');
      }
      setIsProcessing(false); // Only reset loading state if redirection failed
    }
  };

  // 3. CALCULATION METRICS
  const cartTotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black text-gray-900 mb-8">Your Shopping Cart</h1>

        {checkoutError && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm font-semibold rounded-xl border-l-4 border-red-500 shadow-sm">
            ⚠️ {checkoutError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* LEFT SIDE: Items List Wrapper */}
          <div className="md:col-span-2 space-y-4">
            {cartItems.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center shadow-sm">
                <p className="text-gray-500 font-medium">Your cart is currently empty.</p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 bg-gray-50 rounded-xl p-2 border border-gray-100 flex-shrink-0">
                      {item.image.startsWith('http') ? (
                        <img src={item.image} alt={item.title} className="w-full h-full object-contain mix-blend-multiply" />
                      ) : (
                        <div className="w-full h-full bg-gray-200 rounded-lg" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 line-clamp-1">{item.title}</h4>
                      <p className="text-xs text-gray-400 mt-1">Quantity: {item.quantity}</p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-gray-950">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))
            )}
          </div>

          {/* RIGHT SIDE: Order Summary & Gateway Triggers (Pure, isolated button elements) */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
            <h3 className="text-lg font-black text-gray-900 mb-4">Order Summary</h3>
            
            <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
              <span className="text-sm font-medium text-gray-500">Total Amount:</span>
              <span className="text-xl font-black text-gray-950">${cartTotal.toFixed(2)}</span>
            </div>

            <div className="space-y-3">
              {/* MERCADO PAGO GATEWAY TRIGGER */}
              <button
                type="button" 
                disabled={isProcessing || cartItems.length === 0}
                onClick={(e) => handleProcessPayment(e, 'mercadopago')}
                className="w-full h-12 flex items-center justify-center bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? 'Processing Session...' : 'Pay with Mercado Pago'}
              </button>

              {/* STRIPE GATEWAY TRIGGER */}
              <button
                type="button"
                disabled={isProcessing || cartItems.length === 0}
                onClick={(e) => handleProcessPayment(e, 'stripe')}
                className="w-full h-12 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? 'Processing Session...' : 'Pay with Stripe'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}