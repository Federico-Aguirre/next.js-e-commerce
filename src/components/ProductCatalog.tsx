'use client';

import { useSearchParams } from 'next/navigation';
import React from 'react';
import { ProductCard } from '@/components/ecommerce/ProductCard';
import SearchBar from '@/components/SearchBar';
import { TaxInclusivePrice } from '@/components/TaxInclusivePrice';
import { EmptyState } from '@/components/ui/empty-state';
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
        <EmptyState
          className="mx-auto max-w-sm"
          icon="🔍"
          title="No encontramos resultados"
          description="Probá escribiendo otra palabra o limpiando el buscador."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {productosFiltrados.map((product) => {
            if (!product) return null;

            const coverImage = product.variants?.[0]?.images?.[0]?.url || '/placeholder.png';

            return (
              <ProductCard
                key={product.id}
                title={product.name}
                href={`/product/${product.id}`}
                imageSrc={coverImage}
                imageAlt={product.name}
                imageSizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                imageFit="contain"
                priority={Number(product.id) <= 4}
                category={product.category || 'Colección'}
                price={
                  <TaxInclusivePrice
                    amount={Number(product.price)}
                    className="text-lg font-semibold tracking-tight"
                  />
                }
                overlayAction={
                  <div
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
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
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
