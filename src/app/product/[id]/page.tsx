import React from 'react';
import { notFound } from 'next/navigation';
import { Product } from '@/types/product';
import ProductViewer from './ProductViewer'; // Subcomponente interactivo

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

// Arquitectura Senior: Pide de forma aislada un único producto por su ID a GraphQL
async function getProductById(id: number): Promise<Product | null> {
  try {
    const query = `
      query GetSingleProduct($id: Int!) {
        product(id: $id) {
          id
          title
          price
          description
          category
          image
          variants {
            articleId
            colorName
            sizes
            images {
              id
              url
            }
          }
        }
      }
    `;

    const res = await fetch('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id } }),
      cache: 'no-store',
    });

    const json = await res.json();
    return json.data?.product || null;
  } catch (error) {
    console.error("Error fetching single product:", error);
    return null;
  }
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  // En Next.js 15+, params es una Promesa y debe ser resuelta con await
  const resolvedParams = await params;
  const productId = parseInt(resolvedParams.id, 10);

  if (isNaN(productId)) {
    notFound();
  }

  const product = await getProductById(productId);

  // Si el usuario inventa un ID en la URL (ej: /product/99), disparamos la página 404 nativa
  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Delegamos la interactividad (estados de color/talle) al componente especializado */}
        <ProductViewer product={product} />
      </div>
    </main>
  );
}