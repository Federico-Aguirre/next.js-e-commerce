'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';

export default function SuccessPage() {
  const clearCart = useCartStore((state) => state.clearCart);
  const searchParams = useSearchParams();

  const [guardando, setGuardando] = useState(true);
  const [errorVerificacion, setErrorVerificacion] = useState(false);
  const ordenProcesada = useRef(false);

  const paymentId = searchParams.get('payment_id');
  const status = searchParams.get('status');

  useEffect(() => {
    async function confirmOrder() {
      if (status === 'approved' && paymentId && !ordenProcesada.current) {
        ordenProcesada.current = true;

        try {
          const res = await fetch('/api/orders/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId }),
          });

          if (!res.ok) throw new Error('No se pudo verificar o guardar la orden.');

          console.log('🚀 Orden verificada e impactada con éxito');
          localStorage.removeItem('last_pending_order_id');
          clearCart();
        } catch (error) {
          console.error('Error procesando el pago:', error);
          setErrorVerificacion(true);
        } finally {
          setGuardando(false);
        }
      } else {
        setGuardando(false);
      }
    }

    confirmOrder();
  }, [paymentId, status, clearCart]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-md border border-gray-100 text-center space-y-6">
        {errorVerificacion ? (
          <>
            <div className="text-6xl text-rose-500">❌</div>
            <h1 className="text-2xl font-black text-gray-900">Error de Verificación</h1>
            <p className="text-gray-500 text-sm">
              No pudimos comprobar la validez de tu pago. Si creés que esto es un error, contactate con soporte.
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl text-emerald-500">✅</div>
            <h1 className="text-2xl font-black text-gray-900">¡Muchas gracias por tu compra!</h1>

            {guardando ? (
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 text-sm animate-pulse">Confirmando tu orden...</p>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                Comprobante N°: <span className="font-semibold text-gray-700">{paymentId || 'N/A'}</span>
              </p>
            )}
          </>
        )}

        <div className="flex flex-col space-y-3 pt-2">
          <Link
            href="/historial"
            className="w-full bg-indigo-600 py-3 text-sm font-bold text-white rounded-lg hover:bg-indigo-700 transition-colors inline-block text-center"
          >
            Ver mi historial
          </Link>

          <Link
            href="/"
            className="w-full bg-gray-100 py-3 text-sm font-bold text-gray-700 rounded-lg hover:bg-gray-200 transition-colors inline-block text-center"
          >
            Volver a la tienda
          </Link>
        </div>
      </div>
    </main>
  );
}