'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { ProductCard } from '@/components/ecommerce/ProductCard';
import { TaxInclusivePrice } from '@/components/TaxInclusivePrice';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeading } from '@/components/ui/section-heading';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';

interface WishlistItem {
  id: string;
  title: string;
  price: number;
  image: string;
  category?: string;
}

export default function FavoritesPage() {
  const wishlist = useWishlistStore((state) => state.wishlist);
  const addToCart = useCartStore((state) => state.addToCart);
  const [aviso, setAviso] = useState<string | null>(null);

  const handleQuickAdd = (product: WishlistItem) => {
    addToCart({
      id: Number(product.id) || 0,
      articleId: Number(product.id) || 0,
      title: product.title,
      price: product.price,
      image: product.image,
      size: 'M',
      colorName: 'Único',
    });

    setAviso(product.id);
    setTimeout(() => setAviso(null), 2000);
  };

  if (!wishlist || wishlist.length === 0) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen items-center justify-center bg-background p-6"
      >
        <EmptyState
          titleAs="h1"
          className="w-full max-w-sm border-solid shadow-sm"
          icon="♡"
          title="Tu lista de deseos está vacía"
          description="Guardá los artículos que más te gusten para tenerlos siempre a mano."
          action={
            <Button asChild size="lg" className="w-full">
              <Link href="/">Explorar la tienda</Link>
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading level="h1" title="Mi Lista de Deseos" className="mb-6" />

        <div className="grid grid-cols-1 gap-5 pb-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {wishlist.map((item: WishlistItem) => (
            <ProductCard
              key={item.id}
              title={item.title}
              href={`/product/${item.id}`}
              imageSrc={item.image}
              imageAlt={item.title || 'Producto de lista de deseos'}
              imageSizes="(max-width: 768px) 100vw, 300px"
              imageFit="contain"
              category={item.category || 'Colección'}
              price={
                <TaxInclusivePrice
                  amount={item.price}
                  className="text-lg font-semibold tracking-tight"
                />
              }
              footer={
                <Button
                  type="button"
                  variant={aviso === item.id ? 'success' : 'default'}
                  size="lg"
                  className="w-full text-sm"
                  onClick={() => handleQuickAdd(item)}
                >
                  {aviso === item.id
                    ? '¡Agregado con éxito! ✓'
                    : 'Agregar al carrito rápido (Talle M)'}
                </Button>
              }
            />
          ))}
        </div>
      </div>
    </main>
  );
}
