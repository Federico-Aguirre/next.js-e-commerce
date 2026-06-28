import React, { Suspense } from 'react';
import { Product } from '@/types/product';
import GoogleLoginAlert from '@/components/GoogleLoginAlert';
import ProductCatalog from '@/components/ProductCatalog';
import CatalogSkeleton from '@/components/CatalogSkeleton'; 

async function getProducts(): Promise<Product[]> {
  try {
    const query = `
      query GetSeniorCatalog {
        products {
          id
          name
          price
          category
          description
          variants {
            id
            colorName
            images {
              id
              url
            }
            skus {
              id
              articleId
              size
              stock
            }
          }
        }
      }
    `;

    // Determinamos el host dinámicamente según el entorno actual
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    const res = await fetch(`${baseUrl}/api/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      cache: 'no-store', 
    });

    if (!res.ok) {
      console.error(`GraphQL Server responded with status: ${res.status}`);
      return [];
    }

    const json = await res.json();
    
    if (json.errors) {
      console.error('GraphQL Error:', JSON.stringify(json.errors, null, 2));
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
          <Suspense fallback={<CatalogSkeleton />}>
            <ProductCatalog initialProducts={products} />
          </Suspense>
        )}
        
      </div>
    </main>
  );
}