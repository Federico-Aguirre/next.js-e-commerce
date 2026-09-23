import { useEffect, useRef } from 'react';
import { useWishlistStore } from '@/store/useWishlistStore';
import { useAuthStore } from '@/store/useAuthStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3001';

export default function WishlistSynchronizer() {
  const { user, isAuthenticated } = useAuthStore();
  const wishlist = useWishlistStore((state) => state.wishlist);
  const _hasHydrated = useWishlistStore((state) => (state as any)._hasHydrated);

  const isInitialMergeDone = useWishlistStore(
    (state) => (state as any).isInitialMergeDone,
  );
  const setInitialMergeDone = useWishlistStore(
    (state) => (state as any).setInitialMergeDone,
  );

  const currentUserId = user?.id || user?.email || '';

  const isMountedRef = useRef(false);
  const lastUserIdRef = useRef<string>('');
  const isProcessing = useRef<boolean>(false);
  const lastSyncedJson = useRef<string>('');
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      if (activeAbortControllerRef.current)
        activeAbortControllerRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (!isMountedRef.current || !_hasHydrated) return;

    // Reset store state upon user logout
    if (!isAuthenticated || !currentUserId) {
      if (activeAbortControllerRef.current)
        activeAbortControllerRef.current.abort();
      if (lastUserIdRef.current !== '') {
        useWishlistStore.getState().clearWishlist();
        lastUserIdRef.current = '';
        lastSyncedJson.current = '';
      }
      return;
    }

    lastUserIdRef.current = currentUserId;

    // Execute GraphQL sync mutation against backend API
    async function syncWithBackend(
      productIds: number[],
      signal: AbortSignal,
      isInitial: boolean = false,
    ) {
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

        const response = await fetch(`${API_URL}/api/graphql`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            variables: { userId: currentUserId, productIds, isInitial },
          }),
          signal,
        });

        if (!response.ok) return null;
        const result = await response.json();
        if (result.errors) return null;

        return result.data?.syncWishlist || null;
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error(
            '🚨 [WISHLIST SYNC ERROR]: Network request failed:',
            error.message,
          );
        }
        return 'NET_ERROR';
      }
    }

    async function handleSync() {
      if (isProcessing.current) return;
      isProcessing.current = true;

      if (activeAbortControllerRef.current)
        activeAbortControllerRef.current.abort();
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      const currentLocalItems = [...wishlist];

      // Phase 1: Initial authentication merge with server state
      if (!isInitialMergeDone) {
        const serverProducts = await syncWithBackend(
          [],
          controller.signal,
          true,
        );

        if (
          controller.signal.aborted ||
          !isAuthenticated ||
          serverProducts === 'NET_ERROR'
        ) {
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
                image: coverImage,
              });
            }
          });

          currentLocalItems.forEach((prod: any) => {
            if (prod && prod.id)
              combinedMap.set(String(prod.id), {
                ...prod,
                id: String(prod.id),
              });
          });

          const finalMergedList = Array.from(combinedMap.values());

          lastSyncedJson.current = JSON.stringify(finalMergedList);

          setInitialMergeDone(true);
          useWishlistStore.setState({ wishlist: finalMergedList });

          // Instantly persist guest items added prior to session initialization
          if (finalMergedList.length !== serverProducts.length) {
            const numericIds = finalMergedList
              .map((item) => parseInt(item.id, 10))
              .filter(Boolean);
            await syncWithBackend(numericIds, controller.signal, false);
          }
        }
        isProcessing.current = false;
        return;
      }

      // Phase 2: Live updates synchronization
      const currentLocalJson = JSON.stringify(currentLocalItems);

      if (isInitialMergeDone && currentLocalJson !== lastSyncedJson.current) {
        lastSyncedJson.current = currentLocalJson;

        const numericIds = currentLocalItems
          .map((item) => parseInt(item.id, 10))
          .filter(Boolean);
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
  }, [
    isAuthenticated,
    currentUserId,
    wishlist,
    _hasHydrated,
    isInitialMergeDone,
    setInitialMergeDone,
  ]);

  return null;
}
