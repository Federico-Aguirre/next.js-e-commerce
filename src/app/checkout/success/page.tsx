'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';

export default function SuccessPage() {
  const cart = useCartStore((state) => state.cart);
  const clearCart = useCartStore((state) => state.clearCart);
  const searchParams = useSearchParams();
  
  const [guardando, setGuardando] = useState(true);
  const [errorVerificacion, setErrorVerificacion] = useState(false);
  const ordenProcesada = useRef(false);

  useEffect(() => {
    const paymentId = searchParams.get('payment_id');
    const status = searchParams.get('status');

    // MOCK USER ID: Reemplazalo por el de tu sesión (NextAuth) cuando quieras
    const userId = "id-del-usuario-actual"; 

    async function persistirOrden() {
      if (status === 'approved' && paymentId && cart.length > 0 && !ordenProcesada.current) {
        ordenProcesada.current = true;
        
        try {
          // 🛡️ PASO DE SEGURIDAD PREVIO: Validamos que el paymentId sea real en el backend antes de guardar nada
          const verificarRes = await fetch(`/api/orders/verify-payment?paymentId=${paymentId}`);
          const verificacion = await verificarRes.json();

          if (!verificarRes.ok || !verificacion.isApproved) {
            throw new Error("Intento de fraude detectado: el pago no es válido.");
          }

          // Si el pago es real, procedemos a guardar en Aiven con tu lógica de siempre
          const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              paymentId,
              total,
              items: cart
            })
          });

          if (res.ok) {
            console.log("🚀 Orden impactada en PostgreSQL de Aiven con éxito");
            clearCart(); 
          }
        } catch (error) {
          console.error("Error guardando orden:", error);
          setErrorVerificacion(true);
        } finally {
          setGuardando(false);
        }
      } else {
        setGuardando(false);
      }
    }

    persistirOrden();
  }, [cart, clearCart, searchParams]);

  const displayPaymentId = searchParams.get('payment_id') || '...';

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-md border border-gray-100 text-center space-y-6">
        {errorVerificacion ? (
          <>
            <div className="text-6xl text-rose-500">❌</div>
            <h1 className="text-2xl font-black text-gray-900">Error de Verificación</h1>
            <p className="text-gray-500 text-sm">
              No pudimos comprobar la validez de tu pago. Si creés que esto es un error, por favor contactate con soporte.
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl text-emerald-500 animate-bounce">✅</div>
            <h1 className="text-2xl font-black text-gray-900">¡Muchas gracias por tu compra!</h1>
            
            {guardando ? (
              <p className="text-gray-400 text-sm animate-pulse">Registrando tu orden de forma segura en tu historial...</p>
            ) : (
              <p className="text-gray-500 text-sm">
                Tu pago fue procesado con éxito a través de Mercado Pago. <br />
                <span className="font-semibold text-gray-700">Comprobante N°: {displayPaymentId}</span>
              </p>
            )}
          </>
        )}
        
        <div className="flex flex-col space-y-3">
          <Link
            href="/historial"
            className="inline-flex w-full items-center justify-center bg-indigo-600 h-12 text-sm font-bold text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/10"
          >
            Ver mi historial de compras
          </Link>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center bg-gray-100 h-12 text-sm font-bold text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Volver a la tienda
          </Link>
        </div>
      </div>
    </main>
  );
}