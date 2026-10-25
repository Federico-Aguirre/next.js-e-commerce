import React, { Suspense } from 'react';
import GoogleLoginAlert from '@/components/GoogleLoginAlert';
import ProductCatalog from '@/components/ProductCatalog';
import { getPublicCatalogProducts } from '@/lib/catalog/public-catalog';
import type { Product } from '@/types/product';

async function getProducts(): Promise<Product[]> {
  try {
    return await getPublicCatalogProducts();
  } catch (error) {
    console.error('Error loading the public catalogue:', error);
    return [];
  }
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-muted/40 px-4 py-12 sm:px-6 lg:px-8"
    >
      <GoogleLoginAlert />

      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Nuestra Colección
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">Ropa exclusiva diseñada para durar.</p>
        </div>

        {products.length === 0 ? (
          <p className="text-center text-muted-foreground">
            El catálogo no está disponible temporalmente. Volvé a intentar en unos instantes.
          </p>
        ) : (
          <Suspense fallback={null}>
            <ProductCatalog initialProducts={products} />
          </Suspense>
        )}
      </div>
    </main>
  );
}
