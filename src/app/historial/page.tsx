'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';

import { useCartStore } from '@/store/useCartStore';

interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
}

interface Order {
  id: string;
  userId: string;
  total: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export default function HistorialPage() {
  const [compras, setCompras] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    const stripePaymentSuccess = sessionStorage.getItem(
      'stripe_payment_success',
    );

    if (stripePaymentSuccess === 'true') {
      clearCart();

      sessionStorage.removeItem('stripe_payment_success');
    }
    async function obtenerHistorial() {
      try {
        const res = await fetch('/api/orders', {
          cache: 'no-store',
        });

        if (res.ok) {
          const datos: Order[] = await res.json();

          const comprasExitosas = datos.filter(
            (compra) => compra.status === 'PAID',
          );

          setCompras(comprasExitosas);
        } else {
          if (res.status === 401) {
            setErrorMsg('Debes iniciar sesión para ver tus compras.');
          } else {
            setErrorMsg('Ocurrió un error al obtener el historial.');
          }
        }
      } catch (error) {
        console.error('Error leyendo historial de Aiven:', error);

        setErrorMsg('Error de conexión con el servidor.');
      } finally {
        setLoading(false);
      }
    }

    obtenerHistorial();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {' '}
        <p className="text-gray-500 font-medium animate-pulse">
          Cargando tu historial desde la base de datos...{' '}
        </p>{' '}
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        {' '}
        <div className="bg-white border border-gray-100 p-8 rounded-2xl text-center shadow-sm max-w-sm">
          {' '}
          <p className="text-amber-600 font-bold mb-4">⚠️ {errorMsg} </p>
          <Link
            href="/api/auth/signin"
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold block hover:bg-gray-800 transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      {' '}
      <div className="max-w-3xl mx-auto space-y-6">
        {' '}
        <div className="flex justify-between items-center">
          {' '}
          <h1 className="text-3xl font-black text-gray-900">Mis Compras </h1>
          <Link
            href="/"
            className="text-sm font-bold text-indigo-600 hover:underline"
          >
            ← Volver a la tienda
          </Link>
        </div>
        {compras.length === 0 ? (
          <div className="bg-white border border-gray-100 p-12 rounded-2xl text-center shadow-sm">
            <p className="text-gray-400 text-lg mb-4">
              No tenés compras registradas todavía.
            </p>

            <Link
              href="/"
              className="inline-block bg-indigo-600 text-white px-5 h-10 leading-10 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              Ir a comprar
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {compras.map((compra) => (
              <div
                key={compra.id}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                  <div>
                    <h2 className="font-bold text-gray-900 text-sm md:text-base">
                      Orden #{compra.id.slice(-8).toUpperCase()}
                    </h2>

                    <p className="text-xs text-gray-400">
                      Fecha:{' '}
                      {new Date(compra.createdAt).toLocaleDateString('es-AR')}
                    </p>
                  </div>

                  <span className="px-3 py-1 font-bold text-xs rounded-full bg-emerald-100 text-emerald-800">
                    Aprobado
                  </span>
                </div>

                <div className="space-y-3">
                  {compra.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 text-sm text-gray-600"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            className="h-full w-full object-contain"
                            sizes="64px"
                          />
                        </div>

                        <p className="min-w-0">
                          <span className="font-medium text-gray-900">
                            {item.title}
                          </span>{' '}
                          <span className="text-gray-400 font-medium">
                            x{item.quantity}
                          </span>
                        </p>
                      </div>

                      <p className="shrink-0 font-semibold text-gray-900">
                        ${(item.price * item.quantity).toLocaleString('es-AR')}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center border-t border-gray-100 pt-4 font-black text-gray-900">
                  <p className="text-sm">Total pagado:</p>

                  <p className="text-lg text-indigo-600">
                    ${compra.total.toLocaleString('es-AR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
