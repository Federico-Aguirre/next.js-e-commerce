import React, { Suspense } from 'react';
import { Product } from '@/types/product';
import GoogleLoginAlert from '@/components/GoogleLoginAlert';
import ProductCatalog from '@/components/ProductCatalog';

async function triggerAivenWakeUp(baseUrl: string) {
  try {
    await fetch(`${baseUrl}/api/aiven-status`, { cache: 'no-store' });
  } catch (err) {
    console.error('Error al intentar despertar Aiven:', err);
  }
}

async function getProducts(): Promise<Product[]> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3001';

  await triggerAivenWakeUp(baseUrl);

  const query = `
    query GetNovaCatalog {
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

  try {
    const res = await fetch(`${baseUrl}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const json = await res.json();

    if (json.errors) {
      return [];
    }

    return json.data?.products || [];
  } catch (error) {
    console.error('Error fetching from GraphQL:', error);
    return [];
  }
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <GoogleLoginAlert />

      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Nuestra Colección
          </h1>
          <p className="mt-4 text-lg text-gray-500">Ropa exclusiva diseñada para durar.</p>
        </div>

        {products.length === 0 ? (
          <p className="text-center text-gray-500">
            Cargando la tienda o iniciando servidores...
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