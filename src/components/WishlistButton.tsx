'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import React from 'react';
import { Button } from '@/components/ui/button';
import { useWishlistStore } from '@/store/useWishlistStore';

interface WishlistButtonProps {
  product: {
    id: string | number; // 🌟 Flexibilizamos para que acepte los IDs numéricos de Postgres
    title: string;
    price: number;
    image: string;
    category?: string;
  };
}

function WishlistButtonContent({ product }: WishlistButtonProps) {
  const pathname = usePathname();
  const isSpanish = pathname.startsWith('/es');
  const { toggleWishlist, isInWishlist } = useWishlistStore();

  // 🌟 Normalizamos a string acá para que coincida exactamente con las llaves de Zustand
  const productIdStr = String(product.id);
  const favoriteado = isInWishlist(productIdStr);

  return (
    <Button
      variant={favoriteado ? 'favorite' : 'ghost'}
      size="icon"
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        // Pasamos el producto asegurando que Zustand reciba el ID como string
        toggleWishlist({
          ...product,
          id: productIdStr,
        });
      }}
      className={`rounded-full border border-border shadow-sm transition-all duration-300 hover:scale-110 ${favoriteado ? 'bg-favorite/10 hover:bg-favorite/15' : 'bg-background hover:bg-accent'}`}
      title={favoriteado ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      aria-label={
        isSpanish
          ? favoriteado
            ? 'Quitar de favoritos'
            : 'Agregar a favoritos'
          : favoriteado
            ? 'Remove from wishlist'
            : 'Add to wishlist'
      }
      aria-pressed={favoriteado}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={favoriteado ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5 transition-transform active:scale-90"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
    </Button>
  );
}

export default dynamic(() => Promise.resolve(WishlistButtonContent), {
  ssr: false,
  loading: () => (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      disabled
      className="animate-pulse rounded-full border border-border bg-background p-2 text-muted-foreground shadow-sm"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
    </Button>
  ),
});
