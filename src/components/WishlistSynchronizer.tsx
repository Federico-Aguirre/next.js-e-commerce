'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useWishlistStore } from '@/store/useWishlistStore';

export default function WishlistSynchronizer() {
  const { data: session, status } = useSession();
  const wishlist = useWishlistStore((state) => state.wishlist);
  const _hasHydrated = useWishlistStore((state) => (state as any)._hasHydrated);
  
  const isInitialMergeDone = useWishlistStore((state) => (state as any).isInitialMergeDone);
  const setInitialMergeDone = useWishlistStore((state) => (state as any).setInitialMergeDone);
  
  const currentUserId = (session?.user as any)?.id || session?.user?.email || '';
  
  const isClientMountedRef = useRef(false);
  const lastUserIdRef = useRef<string>('');
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
        console.log('🚪 [FRONTEND WISHLIST] Usuario deslogueado. Limpiando Zustand.');
        useWishlistStore.getState().clearWishlist();
        lastUserIdRef.current = '';
        lastSyncedJson.current = '';
      }
      return;
    }

    if (status === 'loading' || !currentUserId) return;
    lastUserIdRef.current = currentUserId;

    // 🚀 ACTUALIZADO: Ahora acepta el parámetro booleano isInitial y lo inyecta en GraphQL
    async function syncWithBackend(productIds: number[], signal: AbortSignal, isInitial: boolean = false) {
      try {
        const query = `
          mutation SyncWishlist($userId: String!, $productIds: [Int!]!, $isInitial: Boolean) {
            syncWishlist(userId: $userId, productIds: $productIds, isInitial: $isInitial) {
              id
              name
              price
              category
              variants {
                images {
                  url
                }
              }
            }
          }
        `;

        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query, 
            variables: { userId: currentUserId, productIds, isInitial } 
          }),
          signal
        });

        if (!response.ok) return null;
        const result = await response.json();
        if (result.errors) return null;

        return result.data?.syncWishlist || null;
      } catch (error: any) {
        if (error.name !== 'AbortError') console.error('🚨 [FRONTEND WISHLIST] Fallo de red:', error.message);
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

      // FASE 1: LOGIN / MERGE INICIAL
      if (!isInitialMergeDone) {
        console.log('🔄 [FRONTEND WISHLIST] Merge Inicial de sesión con flag isInitial: true');
        // Pasamos 'true' para avisarle al backend que solo queremos consultar lo que tiene Postgres
        const serverProducts = await syncWithBackend([], controller.signal, true);
        
        if (controller.signal.aborted || status === 'unauthenticated' || serverProducts === 'NET_ERROR') {
          isProcessing.current = false;
          return;
        }

        if (serverProducts && Array.isArray(serverProducts)) {
          const combinedMap = new Map();
          
          serverProducts.forEach((prod: any) => {
            if (prod && prod.id) {
              const coverImage = prod.variants?.[0]?.images?.[0]?.url || '';
              combinedMap.set(String(prod.id), {
                id: String(prod.id),
                title: prod.name, 
                price: Number(prod.price),
                category: prod.category,
                image: coverImage
              });
            }
          });

          currentLocalItems.forEach((prod: any) => {
            if (prod && prod.id) combinedMap.set(String(prod.id), { ...prod, id: String(prod.id) });
          });

          const finalMergedList = Array.from(combinedMap.values());
          
          lastSyncedJson.current = JSON.stringify(finalMergedList);
          
          setInitialMergeDone(true);
          useWishlistStore.setState({ wishlist: finalMergedList });

          // Si había productos locales agregados como invitado, los subimos de inmediato desactivando el modo inicial
          if (finalMergedList.length !== serverProducts.length) {
            const numericIds = finalMergedList.map(item => parseInt(item.id, 10)).filter(Boolean);
            await syncWithBackend(numericIds, controller.signal, false);
          }
        }
        isProcessing.current = false;
        return;
      }

      // FASE 2: GUARDADO EN CALIENTE
      const currentLocalJson = JSON.stringify(currentLocalItems);
      
      if (isInitialMergeDone && currentLocalJson !== lastSyncedJson.current) {
        console.log('⚡ [FRONTEND WISHLIST] Sincronizando cambio manual en caliente con flag isInitial: false');
        
        lastSyncedJson.current = currentLocalJson;

        const numericIds = currentLocalItems.map(item => parseInt(item.id, 10)).filter(Boolean);
        // Pasamos 'false' (o por defecto) para que el backend limpie y reemplace en Postgres
        await syncWithBackend(numericIds, controller.signal, false);
      }

      setTimeout(() => {
        isProcessing.current = false;
      }, 100);
    }

    const timer = setTimeout(() => {
      handleSync();
    }, 500); 

    return () => clearTimeout(timer);

  }, [status, currentUserId, wishlist, _hasHydrated, isInitialMergeDone, setInitialMergeDone]);

  return null;
}