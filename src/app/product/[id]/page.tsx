import React from 'react';
import { notFound } from 'next/navigation';
import { Product } from '@/types/product';
import ProductViewer from './ProductViewer'; 

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

async function getProductById(id: number): Promise<Product | null> {
  try {
    const query = `
      query GetSingleProduct($id: Int!) {
        product(id: $id) {
          id
          name
          price
          description
          category
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

    // Evitamos problemas de resolución de nombres en producción usando la URL del entorno
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const res = await fetch(`${baseUrl}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id } }),
      cache: 'no-store',
    });

    const json = await res.json();
    
    // Casteamos la respuesta para asegurar la compatibilidad con la interfaz estricta
    return (json.data?.product as Product) || null;
  } catch (error) {
    console.error("Error fetching single product:", error);
    return null;
  }
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const resolvedParams = await params;
  const productId = parseInt(resolvedParams.id, 10);

  if (isNaN(productId)) {
    notFound();
  }

  const product = await getProductById(productId);

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <ProductViewer product={product} />
      </div>
    </main>
  );
}