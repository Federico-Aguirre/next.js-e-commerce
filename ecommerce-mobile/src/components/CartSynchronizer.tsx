import { useEffect, useRef } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3001';

export default function CartSynchronizer() {
  const { user, isAuthenticated } = useAuthStore();
  const { cart, setCart } = useCartStore();

  const currentUserId = user?.id || user?.email || '';

  const lastUserIdRef = useRef<string>('');
  const isInitialMergeDone = useRef<boolean>(false);

  // Mutex lock for sequential execution queue (prevents race conditions)
  const isLoopRunning = useRef<boolean>(false);
  const pendingPayload = useRef<any[] | null>(null);
  const lastSyncedJson = useRef<string>('');

  useEffect(() => {
    // Handle unauthenticated state and clean up active session references
    if (!isAuthenticated || !currentUserId) {
      if (lastUserIdRef.current !== '') {
        setCart([]);
        lastSyncedJson.current = JSON.stringify([]);
        lastUserIdRef.current = '';
      }
      isInitialMergeDone.current = false;
      pendingPayload.current = null;
      return;
    }

    // Reset sync flags if account switch occurs
    if (
      isAuthenticated &&
      lastUserIdRef.current !== '' &&
      lastUserIdRef.current !== currentUserId
    ) {
      setCart([]);
      lastSyncedJson.current = JSON.stringify([]);
      isInitialMergeDone.current = false;
      pendingPayload.current = null;
    }

    lastUserIdRef.current = currentUserId;

    // Dispatches GraphQL cart merge mutation to Next.js API
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

        const response = await fetch(`${API_URL}/api/graphql`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            variables: {
              userId: currentUserId,
              isInitial,
              localCart: items.map((item) => {
                const cleanId = Number(
                  item.articleId || item.productId || item.id || 0,
                );
                return {
                  id: cleanId,
                  productId: cleanId,
                  title: String(item.title || 'Product'),
                  price: Number(item.price || 0),
                  size: String(item.size || 'U'),
                  image: String(item.image || ''),
                  quantity: Number(item.quantity || 1),
                };
              }),
            },
          }),
        });

        const result = await response.json();
        return result.data?.mergeCart || null;
      } catch (error) {
        console.error(
          '🚨 [CART SYNC ERROR]: Network issue during sync:',
          error,
        );
        return null;
      }
    }

    // Queue worker executing sync loops
    async function runSyncLoop() {
      if (isLoopRunning.current) return;
      isLoopRunning.current = true;

      // Mode A: Initial login merge strategy
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
              quantity: Number(dbItem.quantity),
            });
          });
        }

        anonymousLocalCart.forEach((localItem: any) => {
          const finalId = Number(
            localItem.articleId || localItem.productId || localItem.id,
          );
          const key = `${finalId}-${localItem.size.toUpperCase()}`;

          if (consolidatedMap.has(key)) {
            const existing = consolidatedMap.get(key);
            existing.quantity = Math.max(
              existing.quantity,
              Number(localItem.quantity),
            );
          } else {
            consolidatedMap.set(key, {
              id: finalId,
              productId: finalId,
              articleId: finalId,
              title: localItem.title,
              price: Number(localItem.price),
              size: localItem.size,
              image: localItem.image,
              quantity: Number(localItem.quantity),
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

      // Mode B: Sequentially process pending user modifications (+, -, delete)
      while (pendingPayload.current !== null) {
        const currentItemsToSync = pendingPayload.current;
        pendingPayload.current = null;

        lastSyncedJson.current = JSON.stringify(currentItemsToSync);
        await sendSyncRequest(currentItemsToSync, false);
      }

      isLoopRunning.current = false;
    }

    // Change triggers and reactivity
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
  }, [isAuthenticated, currentUserId, cart, setCart]);

  return null;
}
