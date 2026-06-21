'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import SearchBar from '@/components/SearchBar';
import WishlistButton from '@/components/WishlistButton';
import { Product } from '@/types/product';

interface ProductCatalogProps {
  initialProducts: Product[];
}

export default function ProductCatalog({ initialProducts = [] }: ProductCatalogProps) {
  const searchParams = useSearchParams();
  const queryBusqueda = searchParams.get('search') || '';

  const productosSeguros = Array.isArray(initialProducts) ? initialProducts : [];

  // 🌟 CORRECCIÓN: Filtramos usando 'name' que es el campo real de Postgres/Prisma
  const productosFiltrados = productosSeguros.filter((product) =>
    product?.name?.toLowerCase().includes(queryBusqueda.toLowerCase())
  );

  return (
    <>
      {/* 🔍 Barra de búsqueda integrada */}
      <SearchBar />

      {productosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 p-8 max-w-sm mx-auto shadow-sm">
          <p className="text-gray-400 text-3xl mb-2">🔍</p>
          <h3 className="text-sm font-bold text-gray-800">No encontramos resultados</h3>
          <p className="text-xs text-gray-500 mt-1">Probá escribiendo otra palabra o limpiando el buscador.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-4 xl:gap-x-8">
          {productosFiltrados.map((product) => {
            // 🌟 EXTRACCIÓN RELACIONAL: Obtenemos de forma segura la primera foto del primer color
            const coverImage = product.variants?.[0]?.images?.[0]?.url || '';

            return (
              <Link 
                key={product.id} 
                href={`/product/${product.id}`}
                className="group relative flex flex-col bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 ease-out cursor-pointer h-full"
              >
                {/* Contenedor de la Imagen */}
                <div className="relative w-full h-80 bg-gray-50/50 border-b border-gray-100 overflow-hidden">
                  {coverImage && (
                    <Image
                      src={coverImage}
                      alt={product.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      priority={Number(product.id) <= 4}
                      className="object-center object-contain p-6 mix-blend-multiply transform group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  )}
                  
                  {/* 🤍 Botón Favoritos con detención de propagación */}
                  <div 
                    className="absolute top-3 right-3 z-30"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <WishlistButton product={{
                      id: String(product.id),
                      title: product.name,
                      price: Number(product.price),
                      image: coverImage,
                      category: product.category
                    }} />
                  </div>
                </div>
                
                {/* Información del producto */}
                <div className="flex-1 p-5 flex flex-col justify-between bg-white">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 group-hover:text-indigo-600 transition-colors duration-300">
                      {product.name}
                    </h3>
                    <p className="mt-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50 inline-block px-2 py-0.5 rounded">
                      {product.category}
                    </p>
                  </div>
                  
                  <div className="mt-5 flex items-center justify-between">
                    <p className="text-xl font-black text-gray-900">
                      ${product.price.toFixed(2)}
                    </p>
                    <span className="rounded-lg bg-gray-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm group-hover:bg-indigo-600 transition-colors duration-300">
                      Ver detalle
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}