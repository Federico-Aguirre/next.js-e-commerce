import React, { Suspense } from 'react';
import { Product } from '@/types/product';
import GoogleLoginAlert from '@/components/GoogleLoginAlert';
import ProductCatalog from '@/components/ProductCatalog';
import CatalogSkeleton from '@/components/CatalogSkeleton'; // <-- Importamos el nuevo esqueleto

async function getProducts(): Promise<Product[]> {
  try {
    const query = `
      query GetSeniorCatalog {
        products {
          id
          title
          price
          category
          image
        }
      }
    `;

    const res = await fetch('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      cache: 'no-store', 
    });

    // 🛡️ Si el servidor de GraphQL devolvió un error (500, 404, etc), frenamos acá limpiamente
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`GraphQL Server responded with status: ${res.status}`);
      return [];
    }

    const json = await res.json();
    
    if (json.errors) {
      console.error('GraphQL Errors:', json.errors);
      return [];
    }

    return json.data.products;
  } catch (error) {
    console.error("Error fetching from GraphQL:", error);
    return [];
  }
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <GoogleLoginAlert />

      <div className="max-w-7xl mx-auto">
        
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Nuestra Colección
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Ropa exclusiva diseñada para durar.
          </p>
        </header>

        {products.length === 0 ? (
          <p className="text-center text-gray-500">No se encontraron productos en el servidor.</p>
        ) : (
          /* 🚀 REEMPLAZADO: Ahora el fallback renderiza la silueta parpadeante premium */
          <Suspense fallback={<CatalogSkeleton />}>
            <ProductCatalog initialProducts={products} />
          </Suspense>
        )}
        
      </div>
    </main>
  );
}