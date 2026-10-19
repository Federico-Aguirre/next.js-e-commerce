'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React from 'react';
import SearchBar from '@/components/SearchBar';
import { TaxInclusivePrice } from '@/components/TaxInclusivePrice';
import WishlistButton from '@/components/WishlistButton';
import { Product } from '@/types/product';

interface ProductCatalogProps {
  initialProducts?: Product[];
}

export default function ProductCatalog({ initialProducts = [] }: ProductCatalogProps) {
  const searchParams = useSearchParams();
  const queryBusqueda = searchParams.get('search') || '';

  const productosSeguros = Array.isArray(initialProducts) ? initialProducts : [];

  const productosFiltrados = productosSeguros.filter((product) =>
    product?.name?.toLowerCase().includes(queryBusqueda.toLowerCase()),
  );

  return (
    <>
      <SearchBar />

      {productosFiltrados.length === 0 ? (
        <div className="mx-auto max-w-sm rounded-2xl border border-gray-100 bg-white p-8 py-12 text-center shadow-sm">
          <p className="mb-2 text-3xl text-gray-400">🔍</p>
          <h3 className="text-sm font-bold text-gray-800">No encontramos resultados</h3>
          <p className="mt-1 text-xs text-gray-500">
            Probá escribiendo otra palabra o limpiando el buscador.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 xl:gap-x-8">
          {productosFiltrados.map((product) => {
            if (!product) return null;

            const coverImage = product.variants?.[0]?.images?.[0]?.url || '/placeholder.png';

            return (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-xl"
              >
                <div className="relative h-80 w-full overflow-hidden border-b border-gray-100 bg-gray-50/50">
                  <Image
                    src={coverImage}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    priority={Number(product.id) <= 4}
                    className="transform object-contain object-center p-6 mix-blend-multiply transition-transform duration-500 ease-out group-hover:scale-105"
                  />

                  <div
                    className="absolute top-3 right-3 z-30"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <WishlistButton
                      product={{
                        id: String(product.id),
                        title: product.name,
                        price: Number(product.price),
                        image: coverImage,
                        category: product.category,
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-1 flex-col bg-white p-5">
                  <h3 className="line-clamp-2 text-sm font-semibold text-gray-800 transition-colors duration-300 group-hover:text-indigo-600">
                    {product.name}
                  </h3>

                  <div className="mt-3 flex w-full min-w-0 flex-col items-start">
                    <TaxInclusivePrice
                      amount={Number(product.price)}
                      className="text-xl font-black text-gray-900"
                    />
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
