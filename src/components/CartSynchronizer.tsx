'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/store/useCartStore';

export default function CartSynchronizer() {
  const { data: session, status } = useSession();
  const { cart, setCart } = useCartStore();
  
  const currentUserId = (session?.user as any)?.id || session?.user?.email || '';
  
  const lastUserIdRef = useRef<string>('');
  const isInitialMergeDone = useRef<boolean>(false);
  
  // 🔒 Control de la cola secuencial (Previene Race Conditions y rollbacks al restar)
  const isLoopRunning = useRef<boolean>(false);
  const pendingPayload = useRef<any[] | null>(null);
  const lastSyncedJson = useRef<string>('');

  useEffect(() => {
    // 🌟 ESCUDO PROTECTOR: Si se inició un flujo de pago, congelamos la sincronización
    // para evitar colisiones de hilos de sesión (Error 401) y ralentizaciones.
    if (typeof window !== 'undefined' && (window as any).isPaymentInProgress) {
      return;
    }

    // === 1. CONTROL DE SESIÓN Y LIMPIEZA ===
    if (status === 'unauthenticated') {
      if (lastUserIdRef.current !== '') {
        setCart([]);
        lastSyncedJson.current = JSON.stringify([]);
        lastUserIdRef.current = '';
      }
      isInitialMergeDone.current = false;
      pendingPayload.current = null;
      return;
    }

    if (status === 'loading' || !currentUserId) return;

    if (status === 'authenticated' && lastUserIdRef.current !== '' && lastUserIdRef.current !== currentUserId) {
      setCart([]);
      lastSyncedJson.current = JSON.stringify([]);
      isInitialMergeDone.current = false;
      pendingPayload.current = null;
    }

    lastUserIdRef.current = currentUserId;

    console.log("Sincronizando carro para el usuario:", currentUserId);
    console.log("Estado de Zustand actual:", cart);

    // === 2. DECLARACIÓN DE FUNCIONES INTERNAS ===
    async function sendSyncRequest(items: any[], isInitial: boolean) {
      try {
        const query = `
          mutation MergeCart($userId: String!, $localCart: [LocalCartItemInput!]!, $isInitial: Boolean) {
            mergeCart(userId: $userId, localCart: $localCart, isInitial: $isInitial) {
              productId
              title
              price
              size
              image
              quantity
            }
          }
        `;

        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            variables: {
              userId: currentUserId,
              isInitial,
              localCart: items.map(item => {
                const cleanId = Number(item.articleId || item.productId || item.id || 0);
                return {
                  id: cleanId,
                  productId: cleanId,
                  title: String(item.title || 'Producto'),
                  price: Number(item.price || 0),
                  size: String(item.size || 'U'),
                  image: String(item.image || ''),
                  quantity: Number(item.quantity || 1)
                };
              })
            }
          }),
        });

        const result = await response.json();
        return result.data?.mergeCart || null;
      } catch (error) {
        console.error('🚨 Error de red en sincronización:', error);
        return null;
      }
    }

    // Ejecutor de la cola de sincronización
    async function runSyncLoop() {
      if (isLoopRunning.current) return;
      isLoopRunning.current = true;

      // MODO A: Fusión Inicial al loguearse
      if (!isInitialMergeDone.current) {
        const anonymousLocalCart = [...cart];

        const dbServerCart = await sendSyncRequest([], true);
        
        const consolidatedMap = new Map();

        if (dbServerCart && Array.isArray(dbServerCart)) {
          dbServerCart.forEach((dbItem: any) => {
            const finalId = Number(dbItem.productId || dbItem.id);
            const key = `${finalId}-${dbItem.size.toUpperCase()}`;
            consolidatedMap.set(key, {
              id: finalId,
              productId: finalId,
              articleId: finalId,
              title: dbItem.title,
              price: Number(dbItem.price),
              size: dbItem.size,
              image: dbItem.image,
              quantity: Number(dbItem.quantity)
            });
          });
        }

        anonymousLocalCart.forEach((localItem: any) => {
          const finalId = Number(localItem.articleId || localItem.productId || localItem.id);
          const key = `${finalId}-${localItem.size.toUpperCase()}`;

          if (consolidatedMap.has(key)) {
            const existing = consolidatedMap.get(key);
            existing.quantity = Math.max(existing.quantity, Number(localItem.quantity));
          } else {
            consolidatedMap.set(key, {
              id: finalId,
              productId: finalId,
              articleId: finalId,
              title: localItem.title,
              price: Number(localItem.price),
              size: localItem.size,
              image: localItem.image,
              quantity: Number(localItem.quantity)
            });
          }
        });

        const finalMergedCart = Array.from(consolidatedMap.values());

        await sendSyncRequest(finalMergedCart, false);

        lastSyncedJson.current = JSON.stringify(finalMergedCart);
        setCart(finalMergedCart);
        isInitialMergeDone.current = true;
        isLoopRunning.current = false;
        return;
      }

      // MODO B: Clicks comunes posteriores (+, -, borrar)
      while (pendingPayload.current !== null) {
        const currentItemsToSync = pendingPayload.current;
        pendingPayload.current = null; 

        lastSyncedJson.current = JSON.stringify(currentItemsToSync);
        await sendSyncRequest(currentItemsToSync, false);
      }

      isLoopRunning.current = false;
    }

    // === 3. DISPARADORES Y REACCIONES ===
    const currentCartJson = JSON.stringify(cart);

    if (!isInitialMergeDone.current) {
      const timer = setTimeout(() => {
        runSyncLoop();
      }, 400);
      return () => clearTimeout(timer);
    } else if (currentCartJson !== lastSyncedJson.current) {
      pendingPayload.current = cart;
      runSyncLoop();
    }

  }, [status, currentUserId, cart, setCart]);

  return null;
}