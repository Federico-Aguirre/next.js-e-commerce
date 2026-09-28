'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import WishlistButton from '@/components/WishlistButton';
import { useCartStore } from '@/store/useCartStore';
import type { Product, ProductVariant, ProductSku } from '@/types/product';

type ProductViewerProps = {
  product: Product;
};

type ProductGalleryProps = {
  product: Product;
  selectedVariant: ProductVariant;
  activeImageUrl: string;
  setActiveImageUrl: (url: string) => void;
};

type ColorSelectorProps = {
  variants: ProductVariant[];
  selectedVariant: ProductVariant;
  onSelectVariant: (variant: ProductVariant) => void;
};

type SizeSelectorProps = {
  skus: ProductSku[];
  selectedSku: ProductSku | null;
  onSelectSku: (sku: ProductSku) => void;
};

type QuantityControlProps = {
  quantity: number;
  maxStock: number;
  disabled: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
};

function ProductGallery({
  product,
  selectedVariant,
  activeImageUrl,
  setActiveImageUrl,
}: ProductGalleryProps) {
  const images = selectedVariant?.images ?? [];

  return (
    <div className="flex flex-col-reverse">
      {images.length > 1 && (
        <div className="mx-auto mt-6 w-full max-w-2xl sm:block lg:max-w-none">
          <div className="grid grid-cols-4 gap-6" aria-label="Images gallery">
            {images.map((img) => (
              <button
                key={img.id}
                onClick={() => setActiveImageUrl(img.url)}
                className={`relative flex h-24 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 bg-white transition-all ${
                  activeImageUrl === img.url
                    ? 'border-indigo-600 ring-2 ring-indigo-600/20'
                    : 'border-transparent hover:border-gray-300'
                }`}
              >
                <Image src={img.url} alt="Product angle view" fill className="object-contain p-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-gray-100 bg-white">
        {activeImageUrl && (
          <Image
            src={activeImageUrl}
            alt={product?.name || 'Producto'}
            fill
            priority
            className="object-contain object-center p-0"
          />
        )}
        <div className="absolute top-3 right-3 z-10">
          <WishlistButton
            product={
              {
                id: String(product?.id ?? ''),
                title: product?.name ?? '',
                price: Number(product?.price ?? 0),
                image: images[0]?.url || '',
                category: product?.category ?? '',
              } as unknown as Product
            }
          />
        </div>
      </div>
    </div>
  );
}

function ColorSelector({ variants, selectedVariant, onSelectVariant }: ColorSelectorProps) {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-gray-900">
        Color: <span className="font-normal text-gray-500">{selectedVariant?.colorName}</span>
      </h3>
      <div className="mt-3 flex flex-wrap gap-3">
        {variants.map((variant) => (
          <button
            key={variant.id}
            onClick={() => onSelectVariant(variant)}
            className={`rounded-md border px-4 py-2 text-sm font-medium transition-all ${
              selectedVariant?.id === variant.id
                ? 'border-indigo-600 bg-indigo-50 text-indigo-600 ring-1 ring-indigo-600'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {variant.colorName}
          </button>
        ))}
      </div>
    </div>
  );
}

function SizeSelector({ skus, selectedSku, onSelectSku }: SizeSelectorProps) {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-gray-900">Talles Disponibles</h3>
      <div className="mt-3 grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-4">
        {skus.map((sku) => {
          const hasStock = sku.stock > 0;
          const isSelected = selectedSku?.id === sku.id;

          return (
            <button
              key={sku.id}
              disabled={!hasStock}
              onClick={() => onSelectSku(sku)}
              className={`relative flex flex-col items-center justify-center rounded-md border px-4 py-3 text-sm font-medium uppercase transition-all ${
                hasStock
                  ? isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                  : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 line-through'
              }`}
            >
              <span>{sku.size}</span>
            </button>
          );
        })}
      </div>

      {selectedSku && (
        <p className="mt-3 text-sm font-medium text-emerald-600">
          ✓ ¡Disponible! Quedan {selectedSku.stock} unidades en stock.
        </p>
      )}
    </div>
  );
}

function QuantityControl({
  quantity,
  maxStock,
  disabled,
  onDecrease,
  onIncrease,
}: QuantityControlProps) {
  const isIncreaseDisabled = disabled || quantity >= maxStock;

  return (
    <div className="flex w-full flex-col sm:w-auto">
      <span className="mb-2 text-xs font-bold tracking-wider text-gray-400 uppercase">
        Cantidad
      </span>
      <div className="flex h-14 min-w-35 items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4">
        <button
          type="button"
          onClick={onDecrease}
          className="p-1 text-xl font-black text-gray-500 transition-colors select-none hover:text-indigo-600"
        >
          −
        </button>
        <span className="w-8 text-center text-base font-bold text-gray-800 select-none">
          {quantity}
        </span>
        <button
          type="button"
          disabled={isIncreaseDisabled}
          onClick={onIncrease}
          className={`p-1 text-xl font-black transition-colors select-none ${
            isIncreaseDisabled
              ? 'cursor-not-allowed text-gray-300'
              : 'text-gray-500 hover:text-indigo-600'
          }`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function ProductViewer({ product }: ProductViewerProps) {
  const addToCart = useCartStore((state) => state.addToCart);
  const cart = useCartStore((state) => state.cart);

  const initialVariant: ProductVariant = product?.variants?.[0] ?? {
    id: '',
    colorName: 'Default',
    skus: [],
    images: [],
  };

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(initialVariant);
  const [activeImageUrl, setActiveImageUrl] = useState<string>(
    initialVariant.images?.[0]?.url || '',
  );
  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const handleVariantChange = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setActiveImageUrl(variant?.images?.[0]?.url || '');
    setSelectedSku(null);
    setQuantity(1);
  };

  const handleSelectSku = (sku: ProductSku) => {
    setSelectedSku(sku);
    setQuantity(1);
  };

  const handleDecrease = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleIncrease = () => {
    if (selectedSku && quantity < selectedSku.stock) {
      setQuantity(quantity + 1);
    }
  };

  const handleAddToCart = () => {
    if (!selectedSku) {
      return;
    }

    const itemEnCarrito = cart.find(
      (item: { articleId?: string; size?: string; quantity?: number }) =>
        item.articleId === selectedSku.articleId && item.size === selectedSku.size,
    );
    const cantidadActual = itemEnCarrito?.quantity ?? 0;

    if (cantidadActual + quantity > selectedSku.stock) {
      alert(
        `No podés agregar más unidades. Ya tenés ${cantidadActual} en el carrito y el stock máximo es de ${selectedSku.stock}.`,
      );
      return;
    }

    for (let i = 0; i < quantity; i++) {
      addToCart({
        id: product.id,
        articleId: selectedSku.articleId,
        title: product.name,
        price: product.price,
        colorName: selectedVariant?.colorName || '',
        size: selectedSku.size,
        image: selectedVariant?.images?.[0]?.url || '',
        category: product.category,
      } as unknown as Parameters<typeof addToCart>[0]);
    }

    alert(`¡Se añadieron ${quantity} unidad(es) al carrito!`);
    setQuantity(1);
  };

  const skus = selectedVariant?.skus ?? [];
  const variants = product?.variants ?? [];

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
      <ProductGallery
        product={product}
        selectedVariant={selectedVariant}
        activeImageUrl={activeImageUrl}
        setActiveImageUrl={setActiveImageUrl}
      />

      <div className="mt-10 px-4 sm:mt-16 sm:px-0 lg:mt-0">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{product?.name}</h1>

        <div className="mt-3">
          <p className="text-3xl font-bold text-gray-900">
            ${Number(product?.price ?? 0).toFixed(2)}
          </p>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-900">Descripción</h3>
          <p className="mt-2 text-base leading-relaxed text-gray-500">{product?.description}</p>
        </div>

        <ColorSelector
          variants={variants}
          selectedVariant={selectedVariant}
          onSelectVariant={handleVariantChange}
        />

        <SizeSelector skus={skus} selectedSku={selectedSku} onSelectSku={handleSelectSku} />

        <div className="mt-10 flex flex-col items-end gap-4 sm:flex-row sm:items-center">
          <QuantityControl
            quantity={quantity}
            maxStock={selectedSku?.stock ?? 0}
            disabled={!selectedSku}
            onDecrease={handleDecrease}
            onIncrease={handleIncrease}
          />

          <div className="w-full flex-1">
            <button
              type="button"
              disabled={!selectedSku}
              onClick={handleAddToCart}
              className={`flex h-14 w-full items-center justify-center rounded-lg border border-transparent text-base font-bold text-white shadow-lg transition-colors ${
                selectedSku
                  ? 'bg-indigo-600 shadow-indigo-600/10 hover:bg-indigo-700'
                  : 'cursor-not-allowed bg-gray-400 shadow-none'
              }`}
            >
              {selectedSku ? 'Añadir al carrito' : 'Selecciona un talle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
