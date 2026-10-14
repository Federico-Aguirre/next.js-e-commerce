import { notFound } from 'next/navigation';
import React from 'react';
import { productsData } from '@/data/products';
import { prisma } from '@/lib/prisma';
import type { Product } from '@/types/product';
import ProductViewer from './ProductViewer';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

async function getProductById(id: number): Promise<Product | null> {
  const sourceProduct = productsData.find((product) => product.id === id);

  if (!sourceProduct) {
    return null;
  }

  const databaseProduct = await prisma.product.findUnique({
    where: { id },
    select: {
      price: true,
      isActive: true,
      variants: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          colorName: true,
          skus: {
            orderBy: { articleId: 'asc' },
            select: {
              id: true,
              articleId: true,
              size: true,
              stock: true,
            },
          },
        },
      },
    },
  });

  if (!databaseProduct || !databaseProduct.isActive) {
    return null;
  }

  const normalizeVariantName = (value: string) =>
    value
      .toLowerCase()
      .replaceAll('grey', 'gray')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');

  const sourceVariantsByName = new Map(
    sourceProduct.variants.map((variant) => [
      normalizeVariantName(variant.sourceColorName ?? variant.colorName),
      variant,
    ]),
  );

  const variants = databaseProduct.variants.flatMap((databaseVariant, index) => {
    const sourceVariant =
      sourceVariantsByName.get(normalizeVariantName(databaseVariant.colorName)) ??
      sourceProduct.variants[index];

    if (!sourceVariant) return [];

    return [
      {
        ...sourceVariant,
        id: databaseVariant.id,
        sourceColorName: databaseVariant.colorName,
        skus: databaseVariant.skus.map((sku) => ({
          id: sku.id,
          articleId: sku.articleId,
          size: sku.size,
          stock: sku.stock,
        })),
      },
    ];
  });

  if (variants.length === 0) {
    return null;
  }

  return {
    ...sourceProduct,
    price: databaseProduct.price,
    variants,
  };
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
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <ProductViewer product={product} />
      </div>
    </main>
  );
}
