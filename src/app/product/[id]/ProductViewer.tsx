'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Product, ProductVariant, ProductSku } from '@/types/product';
import { useCartStore } from '@/store/useCartStore';
import WishlistButton from '@/components/WishlistButton';

interface ProductViewerProps {
  product: Product;
}

export default function ProductViewer({ product }: ProductViewerProps) {
  const addToCart = useCartStore((state) => state.addToCart);
  // 🌟 Leemos el estado actual del carrito para validar el stock acumulado
  const cart = useCartStore((state) => state.cart);
  
  // Inicializamos con la primera variante de color
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    product.variants[0] || { id: '', colorName: 'Default', skus: [], images: [] }
  );
  
  // La imagen principal inicial es la primera foto de ese color
  const [activeImageUrl, setActiveImageUrl] = useState<string>(
    selectedVariant.images[0]?.url || ''
  );

  // Ahora guardamos el objeto SKU completo seleccionado en lugar de solo un string
  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const handleVariantChange = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setActiveImageUrl(variant.images[0]?.url || '');
    setSelectedSku(null); // Reseteamos el talle seleccionado al cambiar de color
    setQuantity(1);
  };

  const handleDecrease = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleIncrease = () => {
    // Candado para que el contador no supere el stock máximo real disponible
    if (selectedSku && quantity < selectedSku.stock) {
      setQuantity(quantity + 1);
    }
  };

  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
      
      {/* BLOQUE IZQUIERDO: Galería de Imágenes */}
      <div className="flex flex-col-reverse">
        {selectedVariant.images.length > 1 && (
          <div className="mt-6 w-full max-w-2xl mx-auto sm:block lg:max-w-none">
            <div className="grid grid-cols-4 gap-6" aria-label="Images gallery">
              {selectedVariant.images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImageUrl(img.url)}
                  className={`relative h-24 bg-gray-50 rounded-md flex items-center justify-center cursor-pointer overflow-hidden border-2 transition-all ${
                    activeImageUrl === img.url ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <Image
                    src={img.url}
                    alt="Product angle view"
                    fill
                    className="object-center object-contain p-2 mix-blend-multiply"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Visor Principal */}
        <div className="w-full aspect-w-1 aspect-h-1 bg-gray-50 rounded-lg overflow-hidden relative h-125 border border-gray-100">
          {activeImageUrl && (
            <Image
              src={activeImageUrl}
              alt={product.name}
              fill
              priority
              className="w-full h-full object-center object-contain p-8 mix-blend-multiply"
            />
          )}
          <div className="absolute top-3 right-3 z-10">
            <WishlistButton product={{
              id: String(product.id),
              title: product.name,
              price: Number(product.price),
              image: selectedVariant.images[0]?.url || '',
              category: product.category 
            }} />
          </div>
        </div>
      </div>

      {/* BLOQUE DERECHO: Info y Selectores */}
      <div className="mt-10 px-4 sm:px-0 sm:mt-16 lg:mt-0">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{product.name}</h1>
        
        <div className="mt-3">
          <p className="text-3xl text-gray-900 font-bold">${product.price.toFixed(2)}</p>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-900">Descripción</h3>
          <p className="mt-2 text-base text-gray-500 leading-relaxed">{product.description}</p>
        </div>

        {/* Selector de Colores */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-900">
            Color: <span className="font-normal text-gray-500">{selectedVariant.colorName}</span>
          </h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => handleVariantChange(variant)}
                className={`px-4 py-2 text-sm font-medium rounded-md border transition-all ${
                  selectedVariant.id === variant.id
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-600 ring-1 ring-indigo-600'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {variant.colorName}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de Talles con Validación de Stock Real 🚀 */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-900">Talles Disponibles</h3>
          <div className="mt-3 grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-4">
            {selectedVariant.skus.map((sku) => {
              const hasStock = sku.stock > 0;
              const isSelected = selectedSku?.id === sku.id;

              return (
                <button
                  key={sku.id}
                  disabled={!hasStock} // 🛡️ Evita clics si no hay stock
                  onClick={() => {
                    setSelectedSku(sku);
                    setQuantity(1); // Reseteamos cantidad a 1
                  }}
                  className={`py-3 px-4 flex flex-col items-center justify-center text-sm font-medium uppercase rounded-md border transition-all relative ${
                    !hasStock
                      ? 'bg-gray-100 border-gray-200 text-gray-400 line-through cursor-not-allowed'
                      : isSelected
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span>{sku.size}</span>
                </button>
              );
            })}
          </div>
          
          {/* Indicador Numérico de Stock dinámico */}
          {selectedSku && (
            <p className="mt-3 text-sm font-medium text-emerald-600">
              ✓ ¡Disponible! Quedan {selectedSku.stock} unidades en stock.
            </p>
          )}
        </div>

        {/* CONTROLES DE COMPRA */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 items-end sm:items-center">
          
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cantidad</span>
            <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 h-14 justify-between px-4 min-w-35">
              <button
                type="button"
                onClick={handleDecrease}
                className="text-gray-500 hover:text-indigo-600 font-black text-xl p-1 transition-colors select-none"
              >
                −
              </button>
              <span className="text-base font-bold text-gray-800 w-8 text-center select-none">
                {quantity}
              </span>
              <button
                type="button"
                disabled={!selectedSku || quantity >= selectedSku.stock}
                onClick={handleIncrease}
                className={`font-black text-xl p-1 transition-colors select-none ${
                  !selectedSku || quantity >= selectedSku.stock
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:text-indigo-600'
                }`}
              >
                +
              </button>
            </div>
          </div>

          <div className="flex-1 w-full">
            <button
              type="button"
              disabled={!selectedSku}
              onClick={() => {
                if (!selectedSku) return;

                // 🌟 Buscamos si este producto ya está en el carrito para saber cuántos tiene acumulados
                const itemEnCarrito = cart.find(
                  (item) => item.articleId === selectedSku.articleId && item.size === selectedSku.size
                );
                const cantidadActual = itemEnCarrito ? itemEnCarrito.quantity : 0;

                // 🛡️ Candado definitivo: si lo que ya tiene + lo que quiere agregar supera el stock real, frena la operación
                if (cantidadActual + quantity > selectedSku.stock) {
                  alert(`No podés agregar más unidades. Ya tenés ${cantidadActual} en el carrito y el stock máximo es de ${selectedSku.stock}.`);
                  return;
                }

                for (let i = 0; i < quantity; i++) {
                  addToCart({
                    id: product.id,
                    articleId: selectedSku.articleId, 
                    title: product.name,
                    price: product.price,
                    colorName: selectedVariant.colorName,
                    size: selectedSku.size,
                    image: selectedVariant.images[0]?.url || '', 
                    category: product.category,
                  });
                }

                alert(`¡Se añadieron ${quantity} unidad(es) al carrito!`);
                setQuantity(1);
              }}
              className={`w-full h-14 border border-transparent rounded-lg flex items-center justify-center text-base font-bold text-white transition-colors shadow-lg ${
                !selectedSku
                  ? 'bg-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10'
              }`}
            >
              {!selectedSku ? 'Selecciona un talle' : 'Añadir al carrito'}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}