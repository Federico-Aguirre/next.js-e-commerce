'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useWishlistStore } from '@/store/useWishlistStore';

interface WishlistButtonProps {
  product: {
    id: string;
    title: string;
    price: number;
    image: string;
    category?: string;
  };
}

function WishlistButtonContent({ product }: WishlistButtonProps) {
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  
  const favoriteado = isInWishlist(product.id);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(product);
      }}
      className={`p-2 rounded-full transition-all duration-300 shadow-sm border border-gray-100 backdrop-blur-sm hover:scale-110 cursor-pointer ${
        favoriteado 
          ? 'bg-rose-50 text-rose-500 border-rose-100' 
          : 'bg-white text-gray-400 hover:text-gray-600'
      }`}
      title={favoriteado ? "Quitar de favoritos" : "Agregar a favoritos"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={favoriteado ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5 transition-transform active:scale-90"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
    </button>
  );
}

// 🚀 Exportamos dinámicamente el botón desactivando SSR (Server-Side Rendering).
// Mientras carga en el cliente, muestra el esqueleto gris del corazón para que no rompa el diseño.
export default dynamic(() => Promise.resolve(WishlistButtonContent), {
  ssr: false,
  loading: () => (
    <button className="p-2 rounded-full bg-white/80 backdrop-blur-sm text-gray-200 border border-gray-50 shadow-sm animate-pulse">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    </button>
  ),
});