'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic'; 
import { useCartStore, CartItem } from '@/store/useCartStore';

function CheckoutContent() {
  const { cart, addToCart, removeFromCart, getCartTotal } = useCartStore();
  
  // Estados para controlar el flujo de la API de Pago
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const subtotal = getCartTotal();
  const shipping = subtotal > 0 ? 15.0 : 0.0;
  const total = subtotal + shipping;

  // CONTROLADOR CENTRAL INTERNACIONAL PARA PASARELAS DE PAGO
  const handleProcessPayment = async (
    event: React.MouseEvent<HTMLButtonElement>, 
    paymentMethod: 'mercadopago' | 'stripe'
  ) => {
    event.preventDefault();
    setIsProcessing(true);
    setCheckoutError(null);
    try {
      console.log(`Iniciando pago con ${paymentMethod}...`);
      // Tu lógica de pasarela de pago va acá
    } catch (error: any) {
      setCheckoutError(error.message || 'Error al procesar el pago.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecreaseQuantity = (item: CartItem) => {
    // Detectamos el ID real que tenga el producto (local o de DB)
    const currentId = item.articleId || (item as any).productId || item.id;

    if (item.quantity > 1) {
      useCartStore.setState((state) => ({
        cart: state.cart.map((cartItem) => {
          const cartItemId = cartItem.articleId || (cartItem as any).productId || cartItem.id;
          return cartItemId === currentId && cartItem.size === item.size
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem;
        }),
      }));
    } else {
      removeFromCart(currentId, item.size);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="text-center bg-white rounded-2xl border border-gray-100 p-12 shadow-sm max-w-xl mx-auto animate-fade-in">
        <div className="text-gray-300 mb-4 text-6xl">🛒</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Tu carrito está vacío</h2>
        <p className="text-gray-500 text-sm mb-6">
          Parece que aún no has agregado ningún producto de nuestra colección exclusiva.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center bg-indigo-600 px-6 py-3 text-sm font-bold text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/10"
        >
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start animate-fade-in">
      {/* COLUMNA IZQUIERDA: Lista de Productos */}
      <section className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6 gap-y-6 flex flex-col">
        {checkoutError && (
          <div className="p-4 bg-red-50 text-red-700 text-sm font-semibold rounded-xl border-l-4 border-red-500 shadow-sm mb-4">
            ⚠️ {checkoutError}
          </div>
        )}

        {cart.map((item) => {
          // Normalizamos el ID para la Key y las acciones
          const itemRealId = item.articleId || (item as any).productId || item.id;

          return (
            <div 
              key={`${itemRealId}-${item.size}`} 
              className="flex py-6 border-b border-gray-100 last:border-0 last:pb-0 first:pt-0"
            >
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-50 border border-gray-100 p-2">
                {/* 🌟 SOLUCIÓN AL STRING VACÍO Y FALTA DE SIZES PROP */}
                <Image
                  src={item.image && item.image.trim() !== "" ? item.image : "https://placehold.co/150x150?text=No+Image"}
                  alt={item.title || "Producto"}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-center object-contain mix-blend-multiply"
                  priority={false}
                />
              </div>

              <div className="ml-4 flex flex-1 flex-col justify-between sm:ml-6">
                <div className="relative pr-9 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:pr-0">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs text-gray-400 font-semibold">
                      Color: <span className="text-gray-600 font-normal">{item.colorName}</span> | Talle: <span className="text-gray-600 font-normal uppercase">{item.size}</span>
                    </p>
                    <p className="mt-2 text-sm font-black text-gray-900 sm:hidden">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-4 sm:mt-0 sm:pr-9 flex items-center justify-between sm:justify-end gap-x-4">
                    <div className="flex items-center border border-gray-200 rounded-md bg-gray-50">
                      <button
                        type="button"
                        onClick={() => handleDecreaseQuantity(item)}
                        className="px-3 py-1 text-gray-500 hover:text-indigo-600 font-bold transition-colors text-lg"
                      >
                        −
                      </button>
                      <span className="px-2 text-sm font-bold text-gray-800 min-w-6 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="px-3 py-1 text-gray-500 hover:text-indigo-600 font-bold transition-colors text-lg"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(itemRealId, item.size)}
                      className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors p-1"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <p className="hidden sm:block mt-2 text-sm font-black text-gray-900">
                  Total: ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {/* COLUMNA DERECHA: Resumen del Pedido y Pasarelas de Pago */}
      <section className="mt-16 rounded-2xl bg-white border border-gray-100 p-6 shadow-sm lg:col-span-5 lg:mt-0">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">
          Resumen del pedido
        </h2>

        <div className="mt-6 space-y-4 text-sm">
          <div className="flex items-center justify-between text-gray-600">
            <span>Subtotal</span>
            <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Costo de envío estimado</span>
            <span className="font-semibold text-gray-900">${shipping.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-base font-black text-gray-900">
            <span>Total</span>
            <span className="text-xl">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* BOTONES DUALES DE PASARELAS DE PAGO CONTROLADAS */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={isProcessing}
            onClick={(e) => handleProcessPayment(e, 'mercadopago')}
            className="w-full bg-sky-500 text-sm font-bold text-white rounded-lg py-4 px-4 shadow-md hover:bg-sky-600 transition-colors shadow-sky-500/10 disabled:opacity-50 cursor-pointer text-center"
          >
            {isProcessing ? 'Procesando...' : 'Pagar con Mercado Pago'}
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={(e) => handleProcessPayment(e, 'stripe')}
            className="w-full bg-indigo-600 text-sm font-bold text-white rounded-lg py-4 px-4 shadow-md hover:bg-indigo-700 transition-colors shadow-indigo-600/10 disabled:opacity-50 cursor-pointer text-center"
          >
            {isProcessing ? 'Procesando...' : 'Pagar con Stripe'}
          </button>
        </div>
      </section>
    </div>
  );
}

const DynamicCheckoutContent = dynamic(() => Promise.resolve(CheckoutContent), {
  ssr: false, 
  loading: () => (
    <div className="min-h-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Sincronizando carrito con Zustand...</p>
    </div>
  ),
});

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-black tracking-tight text-gray-900 sm:text-4xl mb-8">
          Tu Carrito de Compras
        </h1>
        <DynamicCheckoutContent />
      </div>
    </main>
  );
}