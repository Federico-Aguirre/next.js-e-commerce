import { notFound } from 'next/navigation';
import React from 'react';

import { productsData } from '@/data/products';
import { Product } from '@/types/product';

import ProductViewer from './ProductViewer';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

function getProductById(id: number): Product | null {
  return productsData.find((product) => product.id === id) ?? null;
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const resolvedParams = await params;
  const productId = parseInt(resolvedParams.id, 10);

  if (isNaN(productId)) {
    notFound();
  }

  const product = getProductById(productId);

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <ProductViewer product={product} />
      </div>
    </main>
  );
}
