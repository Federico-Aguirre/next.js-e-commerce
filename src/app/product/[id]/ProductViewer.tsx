'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import { TaxInclusivePrice } from '@/components/TaxInclusivePrice';
import { Button } from '@/components/ui/button';
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[88px_minmax(0,1fr)]">
      {images.length > 1 && (
        <div className="order-2 col-span-full w-full lg:order-none lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:content-start">
          <div className="grid grid-cols-4 gap-3 lg:grid-cols-1" aria-label="Images gallery">
            {images.map((img) => (
              <Button
                variant="outline"
                size="sm"
                key={img.id}
                onClick={() => setActiveImageUrl(img.url)}
                className={`relative flex aspect-square h-auto min-h-16 w-full min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 bg-card p-1 transition-all ${
                  activeImageUrl === img.url
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-transparent hover:border-border'
                }`}
              >
                <Image src={img.url} alt="Product angle view" fill className="object-contain p-0" />
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="relative order-1 aspect-square w-full overflow-hidden rounded-lg border border-border bg-card lg:order-none lg:col-start-2 lg:row-start-1">
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
            product={{
              id: String(product?.id ?? ''),
              title: product?.name ?? '',
              price: Number(product?.price ?? 0),
              image: images[0]?.url || '',
              category: product?.category ?? '',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ColorSelector({ variants, selectedVariant, onSelectVariant }: ColorSelectorProps) {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-foreground">
        Color:{' '}
        <span className="font-normal text-muted-foreground">{selectedVariant?.colorName}</span>
      </h3>
      <div className="mt-3 flex flex-wrap gap-3">
        {variants.map((variant) => (
          <Button
            variant="outline"
            size="sm"
            key={variant.id}
            onClick={() => onSelectVariant(variant)}
            className={`rounded-md border px-4 py-2 text-sm font-medium transition-all ${
              selectedVariant?.id === variant.id
                ? 'border-primary bg-accent text-primary ring-1 ring-primary'
                : 'border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {variant.colorName}
          </Button>
        ))}
      </div>
    </div>
  );
}

function SizeSelector({ skus, selectedSku, onSelectSku }: SizeSelectorProps) {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-foreground">Talles Disponibles</h3>
      <div className="mt-3 grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-4">
        {skus.map((sku) => {
          const hasStock = sku.stock > 0;
          const isSelected = selectedSku?.id === sku.id;

          return (
            <Button
              variant="ghost"
              size="sm"
              key={sku.id}
              disabled={!hasStock}
              onClick={() => onSelectSku(sku)}
              className={`relative flex flex-col items-center justify-center rounded-md border px-4 py-3 text-sm font-medium uppercase transition-all ${
                hasStock
                  ? isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground'
                  : 'cursor-not-allowed border-border bg-muted text-muted-foreground line-through'
              }`}
            >
              <span>{sku.size}</span>
            </Button>
          );
        })}
      </div>

      {selectedSku && (
        <p className="mt-3 text-sm font-medium text-success">
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
      <span className="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        Cantidad
      </span>
      <div className="flex h-14 min-w-35 items-center justify-between rounded-lg border border-border bg-muted/40 px-4">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={onDecrease}
          className="p-1 text-xl font-black text-muted-foreground transition-colors select-none hover:text-primary"
        >
          −
        </Button>
        <span className="w-8 text-center text-base font-bold text-foreground select-none">
          {quantity}
        </span>
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={isIncreaseDisabled}
          onClick={onIncrease}
          className={`p-1 text-xl font-black transition-colors select-none ${
            isIncreaseDisabled
              ? 'cursor-not-allowed text-muted-foreground'
              : 'text-muted-foreground hover:text-primary'
          }`}
        >
          +
        </Button>
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
      (item) =>
        String(item.articleId) === String(selectedSku.articleId) && item.size === selectedSku.size,
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
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{product?.name}</h1>

        <div className="mt-3">
          <TaxInclusivePrice
            amount={Number(product?.price ?? 0)}
            compact={false}
            className="text-3xl font-bold text-foreground"
          />
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-foreground">Descripción</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {product?.description}
          </p>
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
            <Button
              type="button"
              variant="default"
              size="lg"
              disabled={!selectedSku}
              onClick={handleAddToCart}
              className="h-14 w-full shadow-lg disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none"
            >
              {selectedSku ? 'Añadir al carrito' : 'Selecciona un talle'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
