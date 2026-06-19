'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useWishlistStore } from '@/store/useWishlistStore';

export default function WishlistSynchronizer() {
  const { data: session, status } = useSession();
  const wishlist = useWishlistStore((state) => state.wishlist);
  const _hasHydrated = useWishlistStore((state) => (state as any)._hasHydrated);
  
  const currentUserId = (session?.user as any)?.id || session?.user?.email || '';
  
  const isClientMountedRef = useRef(false);
  const lastUserIdRef = useRef<string>('');
  const isInitialMergeDone = useRef<boolean>(false);
  const isProcessing = useRef<boolean>(false);
  const lastSyncedJson = useRef<string>('');
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isClientMountedRef.current = true; 
    return () => {
      if (activeAbortControllerRef.current) activeAbortControllerRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (!isClientMountedRef.current || !_hasHydrated) return;

    if (status === 'unauthenticated') {
      if (activeAbortControllerRef.current) activeAbortControllerRef.current.abort();
      if (lastUserIdRef.current !== '') {
        console.log('🚪 [FRONTEND WISHLIST] Usuario deslogueado. Reseteando banderas internas.');
        lastUserIdRef.current = '';
        isInitialMergeDone.current = false;
        lastSyncedJson.current = '';
      }
      return;
    }

    if (status === 'loading' || !currentUserId) return;
    lastUserIdRef.current = currentUserId;

    async function syncWithBackend(productIds: number[], signal: AbortSignal) {
      try {
        console.log(`🚀 [FRONTEND WISHLIST] Enviando fetch a /api/graphql... IDs del payload:`, productIds);
        
        const query = `
          mutation SyncWishlist($userId: String!, $productIds: [Int!]!) {
            syncWishlist(userId: $userId, productIds: $productIds) {
              id
              title
              price
              image
              category
            }
          }
        `;

        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { userId: currentUserId, productIds } }),
          signal
        });

        if (!response.ok) {
          console.error(`❌ [FRONTEND WISHLIST] Respuesta HTTP no exitosa: ${response.status}`);
          return null;
        }
        
        const result = await response.json();
        
        if (result.errors) {
          console.error('❌ [FRONTEND WISHLIST] Errores devueltos por GraphQL:', result.errors);
          return null;
        }

        console.log('📥 [FRONTEND WISHLIST] GraphQL respondió exitosamente.');
        return result.data?.syncWishlist || null;
      } catch (error: any) {
        if (error.name !== 'AbortError') console.error('🚨 [FRONTEND WISHLIST] Fallo crítico de red:', error.message);
        return 'NET_ERROR';
      }
    }

    async function handleSync() {
      if (isProcessing.current) return;
      isProcessing.current = true;

      if (activeAbortControllerRef.current) activeAbortControllerRef.current.abort();
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      const currentLocalItems = [...wishlist];

      // 🌟 FASE 1: COMBINACIÓN INICIAL AL LOGUEARSE (LOGIN)
      if (!isInitialMergeDone.current) {
        console.log('🔄 [FRONTEND WISHLIST] Ejecutando sincronización de Login. Solicitando historial de base de datos...');
        const serverProducts = await syncWithBackend([], controller.signal);
        
        if (controller.signal.aborted || status === 'unauthenticated' || serverProducts === 'NET_ERROR') {
          isProcessing.current = false;
          return;
        }

        if (serverProducts && Array.isArray(serverProducts)) {
          const combinedMap = new Map();
          
          // 1. Agregamos lo que viene del servidor forzando ID a STRING para el Catálogo
          serverProducts.forEach((prod: any) => {
            if (prod && prod.id) {
              combinedMap.set(String(prod.id), {
                ...prod,
                id: String(prod.id)
              });
            }
          });

          // 2. Agregamos lo local (si hay solapamiento, conserva lo local pero normaliza a STRING)
          currentLocalItems.forEach((prod: any) => {
            if (prod && prod.id) {
              combinedMap.set(String(prod.id), {
                ...prod,
                id: String(prod.id)
              });
            }
          });

          const finalMergedList = Array.from(combinedMap.values());

          console.log('✨ [FRONTEND WISHLIST] Lista consolidada post-merge (DB + Local):', finalMergedList);
          
          lastSyncedJson.current = JSON.stringify(finalMergedList);
          
          // Guardamos en Zustand garantizando que las llaves sean strings idénticas
          useWishlistStore.setState({ wishlist: finalMergedList });

          // Si tras juntar ambos estados hay novedades, guardamos la lista unificada en la DB
          if (finalMergedList.length !== serverProducts.length) {
            console.log('📤 [FRONTEND WISHLIST] El merge local detectó nuevos items ausentes en la DB. Guardando de inmediato...');
            const numericIds = finalMergedList.map(item => parseInt(item.id, 10)).filter(Boolean);
            await syncWithBackend(numericIds, controller.signal);
          }

          isInitialMergeDone.current = true;
        } else {
          isInitialMergeDone.current = true;
        }
        isProcessing.current = false;
        return;
      }

      // 🌟 FASE 2: GUARDADO EN CALIENTE EN LA INTERFAZ (ZUSTAND A DB)
      const currentLocalJson = JSON.stringify(currentLocalItems);
      if (isInitialMergeDone.current && currentLocalJson !== lastSyncedJson.current) {
        console.log('⚡ [FRONTEND WISHLIST] Cambio detectado en el estado local de Zustand. Guardando cambios en caliente...');
        
        // Garantizamos mapear strings de Zustand a los enteros que espera la BD
        const numericIds = currentLocalItems.map(item => parseInt(item.id, 10)).filter(Boolean);
        const response = await syncWithBackend(numericIds, controller.signal);
        if (response !== 'NET_ERROR') {
          lastSyncedJson.current = currentLocalJson;
        }
      }

      isProcessing.current = false;
    }

    const timer = setTimeout(() => {
      handleSync();
    }, 1000);

    return () => clearTimeout(timer);

  }, [status, currentUserId, wishlist, _hasHydrated]);

  return null;
}