'use client';

import { Check, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CatalogProduct } from '@/commerce/catalog-domain';
import { Price } from '@/components/ecommerce/Price';
import { QuantitySelector } from '@/components/ecommerce/QuantitySelector';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/useCartStore';

type ProductPurchaseProps = {
  product: CatalogProduct;
  addToCartLabel: string;
  buyNowLabel: string;
  quantityLabel: string;
  locale: string;
  sizeLabel: string;
  selectSizeLabel: string;
  sizeRequiredLabel: string;
  colorLabel: string;
  addedToCartLabel: string;
};

const numericId = (value: string) =>
  [...value].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7);

const databaseProductId = (value: string) => {
  const match = value.match(/(?:^|-)\d+$/);
  if (!match) return numericId(value);
  const parsed = Number(value.split('-').at(-1));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : numericId(value);
};

export function ProductPurchase({
  product,
  addToCartLabel,
  buyNowLabel,
  quantityLabel,
  locale,
  sizeLabel,
  selectSizeLabel,
  sizeRequiredLabel,
  colorLabel,
  addedToCartLabel,
}: ProductPurchaseProps) {
  const [selectedMediaId, setSelectedMediaId] = useState(product.media[0]?.id);
  const [cartAdded, setCartAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const selectedVariant =
    product.variants.find((item) => item.id === selectedVariantId) ?? product.variants[0];
  const selectedMedia =
    selectedVariant?.media.find((media) => media.id === selectedMediaId) ??
    selectedVariant?.media[0];
  const addToCart = useCartStore((state) => state.addToCart);
  const beginBuyNow = useCartStore((state) => state.beginBuyNow);
  const cancelBuyNow = useCartStore((state) => state.cancelBuyNow);
  const router = useRouter();

  if (!selectedVariant || !selectedMedia) return null;

  const availableSizes = Object.entries(selectedVariant.sizeStock ?? {});
  const selectedSizeData = selectedSize ? selectedVariant.sizeStock?.[selectedSize] : undefined;

  const selectVariant = (variantId: string) => {
    const nextVariant = product.variants.find((item) => item.id === variantId);
    setSelectedVariantId(variantId);
    setSelectedSize(null);
    setQuantity(1);
    setSizeError(false);
    setSelectedMediaId(nextVariant?.media[0]?.id ?? '');
  };

  const selectMedia = (mediaId: string) => {
    const mediaVariant = product.variants.find((variant) =>
      variant.media.some((media) => media.id === mediaId),
    );

    if (mediaVariant && mediaVariant.id !== selectedVariant.id) {
      setSelectedVariantId(mediaVariant.id);
      setSelectedSize(null);
      setQuantity(1);
      setSizeError(false);
    }

    setSelectedMediaId(mediaId);
  };

  const getSelectedCartItem = () => {
    if (availableSizes.length > 0 && !selectedSizeData) {
      setSizeError(true);
      return null;
    }

    const productId = databaseProductId(product.id);
    const articleId = selectedSizeData?.articleId ?? numericId(selectedVariant.id);
    const stock = selectedSizeData?.stock ?? selectedVariant.inventory.availableQuantity;

    if (stock <= 0) return null;

    return {
      stock,
      item: {
        id: productId,
        productId,
        articleId,
        variantId: selectedSizeData?.variantId,
        title: product.name,
        price: selectedVariant.price.amount,
        colorName: selectedVariant.name,
        size: selectedSize ?? selectedVariant.name,
        image: selectedMedia.url,
        category: product.categories[0]?.slug,
      },
    };
  };

  const addProductToCart = () => {
    const selected = getSelectedCartItem();
    if (!selected) return;

    cancelBuyNow();
    for (let index = 0; index < quantity; index += 1) {
      addToCart(selected.item, selected.stock);
    }
    setCartAdded(true);
  };

  const buyNow = () => {
    const selected = getSelectedCartItem();
    if (!selected) return;

    const started = beginBuyNow(selected.item, quantity, selected.stock);
    if (!started) return;

    sessionStorage.removeItem('stripe_checkout_key');
    router.push(`/checkout/select?lang=${locale === 'en-US' ? 'en' : 'es'}`);
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
      <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(88px,112px)_minmax(0,1fr)]">
        <div className="order-2 grid grid-cols-4 gap-3 sm:order-1 sm:grid-cols-1">
          {product.media.map((media) => (
            <Button
              variant="outline"
              size="sm"
              key={media.id}
              type="button"
              onClick={() => selectMedia(media.id)}
              className={`relative aspect-square h-auto min-h-16 w-full min-w-0 cursor-pointer overflow-hidden rounded-xl border-2 bg-card p-1 transition-colors ${selectedMedia.id === media.id ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}
              aria-label={media.alt ?? product.name}
              aria-pressed={selectedMedia.id === media.id}
            >
              <Image
                src={media.url}
                alt={media.alt ?? product.name}
                fill
                sizes="(min-width: 640px) 100px, 25vw"
                className="object-contain p-2"
              />
            </Button>
          ))}
        </div>
        <div className="relative order-1 aspect-[4/5] min-w-0 overflow-hidden rounded-3xl border border-border bg-card sm:order-2">
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
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          {product.name}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{product.name}</h1>
        <div className="mt-5 text-lg">
          <Price money={selectedVariant.price} locale={locale} />
        </div>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
          {product.description}
        </p>
        <div className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-5">
          {product.variants.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-medium">{colorLabel}</p>
              <div role="group" aria-label={colorLabel} className="flex flex-wrap gap-2">
                {product.variants.map((item) => (
                  <Button
                    variant="outline"
                    size="sm"
                    key={item.id}
                    type="button"
                    onClick={() => selectVariant(item.id)}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${item.id === selectedVariant.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card hover:bg-accent hover:text-accent-foreground'}`}
                    aria-pressed={item.id === selectedVariant.id}
                  >
                    {item.optionValues.color ?? item.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {availableSizes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">{sizeLabel}</p>
              <div
                role="group"
                aria-label={sizeLabel}
                aria-describedby={sizeError ? 'size-selection-error' : undefined}
                className="flex flex-wrap gap-2"
              >
                {availableSizes.map(([size, data]) => (
                  <Button
                    variant="outline"
                    size="sm"
                    key={size}
                    type="button"
                    disabled={data.stock <= 0}
                    onClick={() => {
                      setSelectedSize(size);
                      setSizeError(false);
                    }}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${selectedSize === size ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card hover:bg-accent hover:text-accent-foreground'}`}
                    aria-pressed={selectedSize === size}
                  >
                    {size} ({data.stock})
                  </Button>
                ))}
              </div>
              {!selectedSize && (
                <p className="mt-2 text-xs text-muted-foreground">{selectSizeLabel}</p>
              )}
              {sizeError && (
                <p
                  id="size-selection-error"
                  role="alert"
                  aria-live="assertive"
                  className="mt-2 text-sm text-destructive"
                >
                  {sizeRequiredLabel}
                </p>
              )}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">{quantityLabel}</p>
              <QuantitySelector
                max={Math.min(
                  selectedSizeData?.stock ?? selectedVariant.inventory.availableQuantity,
                )}
                value={quantity}
                onChange={setQuantity}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={!selectedVariant.available}
                onClick={addProductToCart}
                className="min-h-12"
              >
                <Check className="mr-2 size-4" aria-hidden="true" />
                {addToCartLabel}
              </Button>
              <Button
                type="button"
                variant="default"
                size="lg"
                disabled={!selectedVariant.available}
                onClick={buyNow}
                className="min-h-12"
              >
                <ShoppingBag className="mr-2 size-4" aria-hidden="true" />
                {buyNowLabel}
              </Button>
            </div>
            <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {cartAdded ? addedToCartLabel : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
