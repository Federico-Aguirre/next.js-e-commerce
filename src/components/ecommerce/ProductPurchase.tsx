'use client';

import { Check } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import type { CatalogProduct } from '@/commerce/catalog-domain';
import { Price } from '@/components/ecommerce/Price';
import { QuantitySelector } from '@/components/ecommerce/QuantitySelector';
import { useCartStore } from '@/store/useCartStore';

type ProductPurchaseProps = {
  product: CatalogProduct;
  addToCartLabel: string;
  quantityLabel: string;
  maxQuantity: number;
  locale: string;
  stockLabel: string;
  sizeLabel: string;
  selectSizeLabel: string;
  sizeRequiredLabel: string;
};

const numericId = (value: string) =>
  [...value].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );

export function ProductPurchase({
  product,
  addToCartLabel,
  quantityLabel,
  maxQuantity,
  locale,
  stockLabel,
  sizeLabel,
  selectSizeLabel,
  sizeRequiredLabel,
}: ProductPurchaseProps) {
  const [selectedMediaId, setSelectedMediaId] = useState(product.media[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants[0]?.id,
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const selectedVariant =
    product.variants.find((item) => item.id === selectedVariantId) ??
    product.variants[0];
  const selectedMedia =
    selectedVariant?.media.find((media) => media.id === selectedMediaId) ??
    selectedVariant?.media[0];
  const addToCart = useCartStore((state) => state.addToCart);

  if (!selectedVariant || !selectedMedia) return null;

  const availableSizes = Object.entries(selectedVariant.sizeStock ?? {});
  const selectedSizeData = selectedSize
    ? selectedVariant.sizeStock?.[selectedSize]
    : undefined;

  const selectVariant = (variantId: string) => {
    const nextVariant = product.variants.find((item) => item.id === variantId);
    setSelectedVariantId(variantId);
    setSelectedSize(null);
    setQuantity(1);
    setSizeError(false);
    setSelectedMediaId(nextVariant?.media[0]?.id ?? '');
  };

  const addProductToCart = () => {
    if (availableSizes.length > 0 && !selectedSizeData) {
      setSizeError(true);
      return;
    }

    const articleId =
      selectedSizeData?.articleId ?? numericId(selectedVariant.id);
    const stock =
      selectedSizeData?.stock ?? selectedVariant.inventory.availableQuantity;
    addToCart(
      {
        id: numericId(product.id),
        productId: numericId(product.id),
        articleId,
        title: product.name,
        price: selectedVariant.price.amount,
        colorName: selectedVariant.name,
        size: selectedSize ?? selectedVariant.name,
        image: selectedMedia.url,
        category: product.categories[0]?.slug,
      },
      stock,
    );

    for (let index = 1; index < quantity; index += 1) {
      addToCart(
        {
          id: numericId(product.id),
          productId: numericId(product.id),
          articleId,
          title: product.name,
          price: selectedVariant.price.amount,
          colorName: selectedVariant.name,
          size: selectedSize ?? selectedVariant.name,
          image: selectedMedia.url,
          category: product.categories[0]?.slug,
        },
        stock,
      );
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
      <div className="grid min-w-0 gap-4 sm:grid-cols-[0.18fr_1fr]">
        <div className="order-2 grid grid-cols-4 gap-3 sm:order-1 sm:grid-cols-1">
          {product.media.map((media) => (
            <button
              key={media.id}
              type="button"
              onClick={() => setSelectedMediaId(media.id)}
              className={`relative aspect-square cursor-pointer overflow-hidden rounded-xl border bg-white ${selectedMedia.id === media.id ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
              aria-label={media.alt ?? product.name}
            >
              <Image
                src={media.url}
                alt={media.alt ?? product.name}
                fill
                sizes="(min-width: 640px) 100px, 25vw"
                className="object-contain p-2"
              />
            </button>
          ))}
        </div>
        <div className="relative order-1 aspect-[4/5] min-w-0 overflow-hidden rounded-3xl border border-border bg-white sm:order-2">
          <Image
            src={selectedMedia.url}
            alt={selectedMedia.alt ?? product.name}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-contain p-0"
          />
        </div>
      </div>

      <div className="flex flex-col justify-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {product.name}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {product.name}
        </h1>
        <div className="mt-5 text-lg">
          <Price money={selectedVariant.price} locale={locale} />
        </div>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
          {product.description}
        </p>
        <div className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-5">
          {product.variants.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-medium">Color</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectVariant(item.id)}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${item.id === selectedVariant.id ? 'border-primary bg-primary/10' : 'border-border'}`}
                  >
                    {item.optionValues.color ?? item.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {availableSizes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">{sizeLabel}</p>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map(([size, data]) => (
                  <button
                    key={size}
                    type="button"
                    disabled={data.stock <= 0}
                    onClick={() => {
                      setSelectedSize(size);
                      setSizeError(false);
                    }}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${selectedSize === size ? 'border-primary bg-primary/10' : 'border-border'}`}
                  >
                    {size} ({data.stock})
                  </button>
                ))}
              </div>
              {!selectedSize && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {selectSizeLabel}
                </p>
              )}
              {sizeError && (
                <p className="mt-2 text-sm text-red-600">{sizeRequiredLabel}</p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-sm font-medium">{quantityLabel}</p>
              <QuantitySelector
                max={Math.min(
                  maxQuantity,
                  selectedSizeData?.stock ??
                    selectedVariant.inventory.availableQuantity,
                )}
                value={quantity}
                onChange={setQuantity}
                stockLabel={stockLabel}
              />
            </div>
            <button
              type="button"
              disabled={!selectedVariant.available}
              onClick={addProductToCart}
              className="inline-flex min-h-12 min-w-48 cursor-pointer items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="mr-2 size-4" aria-hidden="true" />
              {addToCartLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
