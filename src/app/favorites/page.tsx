'use client';

import React, { useState } from 'react'; 
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useWishlistStore } from '@/store/useWishlistStore';
import { useCartStore } from '@/store/useCartStore';
import WishlistButton from '@/components/WishlistButton';

// 🛡️ Interfaz clara para los productos de la Wishlist
interface WishlistItem {
  id: string;
  title: string;
  price: number;
  image: string;
  category?: string;
}

function WishlistContent() {
  const wishlist = useWishlistStore((state) => state.wishlist);
  const addToCart = useCartStore((state) => state.addToCart);
  
  // Tipamos el estado del aviso
  const [aviso, setAviso] = useState<string | null>(null);

  const handleQuickAdd = (product: WishlistItem) => {
    // Adaptamos los datos al formato que espera tu carrito de Zustand
    addToCart({
      // 🚀 ARREGLADO: Convertimos el id de string a number de manera segura
      articleId: Number(product.id) || 0,
      title: product.title,
      price: product.price,
      image: product.image,
      size: 'M', // Talle estándar para la compra rápida
      colorName: 'Único'
    });
    
    setAviso(product.id);
    setTimeout(() => setAviso(null), 2000);
  };

  if (wishlist.length === 0) {
    return (
      <div className="text-center bg-white rounded-2xl border border-gray-100 p-16 shadow-sm max-w-xl mx-auto">
        <div className="text-gray-200 mb-4 text-7xl">❤️</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Tu lista de deseos está vacía</h2>
        <p className="text-gray-500 text-sm mb-8 text-balance">
          Guardá los artículos que más te gusten haciendo clic en el corazón para tenerlos siempre a mano y sumarlos al carrito cuando quieras.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center bg-indigo-600 px-6 h-12 text-sm font-bold text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/10"
        >
          Explorar la tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {wishlist.map((item) => (
        <div 
          key={item.id} 
          className="group relative bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
        >
          {/* Botón flotante del corazón */}
          <div className="absolute top-6 right-6 z-10">
            <WishlistButton product={item} />
          </div>

          <div>
            {/* Contenedor de la Imagen */}
            <div className="relative h-48 w-full rounded-xl bg-gray-50 overflow-hidden mb-4 p-4 flex items-center justify-center">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-contain group-hover:scale-105 transition-transform duration-300 mix-blend-multiply"
              />
            </div>

            {/* Textos y Precios */}
            <span className="text-xs text-indigo-600 font-bold uppercase tracking-wider">{item.category || "Colección"}</span>
            <h3 className="text-sm font-bold text-gray-800 mt-1 line-clamp-2 h-10">
              {item.title}
            </h3>
            <p className="text-base font-black text-gray-900 mt-2">
              ${item.price.toFixed(2)}
            </p>
          </div>

          {/* Botón de Compra Rápida */}
          <button
            type="button"
            onClick={() => handleQuickAdd(item)}
            className={`w-full mt-4 h-11 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
              aviso === item.id 
                ? 'bg-emerald-500 text-white' 
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            {aviso === item.id ? (
              <>¡Agregado con éxito! ✓</>
            ) : (
              <>
                <span>🛒</span> Agregar al carrito rápido (Talle M)
              </>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

// Desactivamos SSR para acoplar el localStorage de la Wishlist sin saltos de interfaz
const DynamicWishlistContent = dynamic(() => Promise.resolve(WishlistContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-40 flex items-center justify-center">
      <p className="text-gray-400 text-sm animate-pulse">Cargando tus favoritos...</p>
    </div>
  ),
});

export default function WishlistPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
            Mi Lista de Deseos
          </h1>
        </div>
        <DynamicWishlistContent />
      </div>
    </main>
  );
}