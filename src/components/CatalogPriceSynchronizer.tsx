'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';

type CanonicalProduct = {
  id: number;
  title: string;
  price: number;
  category?: string;
};

function canonicalProductId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) {
    const numeric = Number(normalized);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : undefined;
  }
  const catalogId = /^prod-(\d+)$/i.exec(normalized);
  if (!catalogId) return undefined;
  const numeric = Number(catalogId[1]);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : undefined;
}

/** Corrects old USD amounts saved in browsers before the catalogue moved to ARS. */
export default function CatalogPriceSynchronizer() {
  const cart = useCartStore((state) => state.cart);
  const wishlist = useWishlistStore((state) => state.wishlist);
  const lastLookupKey = useRef('');

  const productIdsKey = useMemo(() => {
    const ids = new Set<number>();
    for (const item of cart) {
      const id = canonicalProductId(item.id) ?? canonicalProductId(item.productId);
      if (id) ids.add(id);
    }
    for (const item of wishlist) {
      const id = canonicalProductId(item.id);
      if (id) ids.add(id);
    }
    return [...ids].sort((a, b) => a - b).join(',');
  }, [cart, wishlist]);

  useEffect(() => {
    if (!productIdsKey) {
      lastLookupKey.current = '';
      return;
    }
    if (lastLookupKey.current === productIdsKey) return;
    lastLookupKey.current = productIdsKey;

    const productIds = productIdsKey.split(',').map(Number);
    const controller = new AbortController();

    void fetch('/api/catalog/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds }),
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('The catalogue prices could not be refreshed.');
        return (await response.json()) as { currency?: string; products?: CanonicalProduct[] };
      })
      .then((data) => {
        if (data.currency !== 'ARS' || !Array.isArray(data.products)) return;
        const byId = new Map(data.products.map((product) => [String(product.id), product]));

        const currentCart = useCartStore.getState().cart;
        let cartChanged = false;
        const correctedCart = currentCart.map((item) => {
          const productId = canonicalProductId(item.id) ?? canonicalProductId(item.productId);
          const product = productId ? byId.get(String(productId)) : undefined;
          if (!product || (item.price === product.price && item.title === product.title))
            return item;
          cartChanged = true;
          return { ...item, price: product.price, title: product.title };
        });
        if (cartChanged) useCartStore.getState().setCart(correctedCart);

        const currentWishlist = useWishlistStore.getState().wishlist;
        let wishlistChanged = false;
        const correctedWishlist = currentWishlist.map((item) => {
          const productId = canonicalProductId(item.id);
          const product = productId ? byId.get(String(productId)) : undefined;
          if (!product || (item.price === product.price && item.title === product.title))
            return item;
          wishlistChanged = true;
          return {
            ...item,
            price: product.price,
            title: product.title,
            category: product.category,
          };
        });
        if (wishlistChanged) useWishlistStore.setState({ wishlist: correctedWishlist });
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          console.error('Unable to refresh saved cart/wishlist prices:', error);
        }
      });

    return () => controller.abort();
  }, [productIdsKey]);

  return null;
}
