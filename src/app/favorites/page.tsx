'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useWishlistStore } from '@/store/useWishlistStore';
import { useCartStore } from '@/store/useCartStore';

interface WishlistItem {
  id: string;
  title: string;
  price: number;
  image: string;
  category?: string;
}

export default function FavoritesPage() {
  const wishlist = useWishlistStore((state) => state.wishlist);
  const addToCart = useCartStore((state) => state.addToCart);
  const [aviso, setAviso] = useState<string | null>(null);

  const handleQuickAdd = (product: WishlistItem) => {
    addToCart({
      id: Number(product.id) || 0,
      articleId: Number(product.id) || 0,
      title: product.title,
      price: product.price,
      image: product.image,
      size: 'M',
      colorName: 'Único',
    });

    setAviso(product.id);
    setTimeout(() => setAviso(null), 2000);
  };

  if (!wishlist || wishlist.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center max-w-sm w-full shadow-sm">
          <div className="text-6xl mb-4">❤️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Tu lista de deseos está vacía
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Guardá los artículos que más te gusten para tenerlos siempre a mano.
          </p>
          <Link
            href="/"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-sm transition-colors w-full"
          >
            Explorar la tienda
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-black text-gray-900 mb-6">
          Mi Lista de Deseos
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-8">
          {wishlist.map((item: WishlistItem) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="relative h-44 w-full mb-3 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                  <Image
                    src={
                      item.image && item.image.trim() !== ''
                        ? item.image
                        : 'https://placehold.co/300x300?text=No+Image'
                    }
                    alt={item.title || 'Producto de lista de deseos'}
                    fill
                    sizes="(max-width: 768px) 100vw, 300px"
                    className="object-contain p-2"
                  />
                </div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                  {item.category || 'Colección'}
                </span>
                <h3 className="text-sm font-bold text-gray-800 mt-1 line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-lg font-black text-gray-900 mt-2">
                  ${item.price.toFixed(2)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleQuickAdd(item)}
                className={`mt-4 w-full h-11 rounded-lg text-xs font-bold text-white transition-colors flex items-center justify-center ${
                  aviso === item.id ? 'bg-emerald-500' : 'bg-gray-900 hover:bg-black'
                }`}
              >
                {aviso === item.id ? '¡Agregado con éxito! ✓' : '🛒 Agregar al carrito rápido (Talle M)'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}