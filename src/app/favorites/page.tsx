'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useState } from 'react';
import { TaxInclusivePrice } from '@/components/TaxInclusivePrice';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';

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
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-6xl">❤️</div>
          <h2 className="mb-2 text-xl font-bold text-gray-800">Tu lista de deseos está vacía</h2>
          <p className="mb-6 text-sm text-gray-500">
            Guardá los artículos que más te gusten para tenerlos siempre a mano.
          </p>
          <Link
            href="/"
            className="inline-block w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
          >
            Explorar la tienda
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-3xl font-black text-gray-900">Mi Lista de Deseos</h1>

        <div className="grid grid-cols-1 gap-6 pb-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {wishlist.map((item: WishlistItem) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div>
                <div className="relative mb-3 flex h-44 w-full items-center justify-center overflow-hidden rounded-lg bg-gray-50">
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
                <span className="text-xs font-bold tracking-wider text-indigo-600 uppercase">
                  {item.category || 'Colección'}
                </span>
                <h3 className="mt-1 line-clamp-2 text-sm font-bold text-gray-800">{item.title}</h3>
                <TaxInclusivePrice
                  amount={item.price}
                  className="mt-2 text-lg font-black text-gray-900"
                />
              </div>

              <button
                type="button"
                onClick={() => handleQuickAdd(item)}
                className={`mt-4 flex h-11 w-full items-center justify-center rounded-lg text-xs font-bold text-white transition-colors ${
                  aviso === item.id ? 'bg-emerald-500' : 'bg-gray-900 hover:bg-black'
                }`}
              >
                {aviso === item.id
                  ? '¡Agregado con éxito! ✓'
                  : '🛒 Agregar al carrito rápido (Talle M)'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
