'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Product, ProductVariant } from '@/types/product';
import { useCartStore } from '@/store/useCartStore';
import WishlistButton from '@/components/WishlistButton';

interface ProductViewerProps {
  product: Product;
}

export default function ProductViewer({ product }: ProductViewerProps) {
  const addToCart = useCartStore((state) => state.addToCart);
  
  // Inicializamos la variante por defecto con la primera disponible del catálogo
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    product.variants[0] || { articleId: 0, colorName: 'Default', sizes: [], images: [] }
  );
  
  // Controlamos cuál de las múltiples imágenes de la variante se está visualizando en grande
  const [activeImageUrl, setActiveImageUrl] = useState<string>(
    selectedVariant.images[0]?.url || product.image
  );

  const [selectedSize, setSelectedSize] = useState<string>('');

  // NUEVO ESTADO SENIOR: Control de cantidad local tipado implícitamente como número
  const [quantity, setQuantity] = useState<number>(1);

  // Manejador Senior: Cuando cambia el color, actualiza la variante, las fotos y resetea el talle elegido
  const handleVariantChange = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setActiveImageUrl(variant.images[0]?.url || product.image);
    setSelectedSize(''); // Reseteamos el talle para evitar inconsistencias
  };

  const handleDecrease = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleIncrease = () => {
    setQuantity(quantity + 1);
  };

  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
      
      {/* BLOQUE IZQUIERDO: Galería de Imágenes Dinámica */}
      <div className="flex flex-col-reverse">
        {/* Lista de miniaturas (ángulos disponibles) */}
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

        {/* Visor de Imagen Principal */}
        <div className="w-full aspect-w-1 aspect-h-1 bg-gray-50 rounded-lg overflow-hidden relative h-125 border border-gray-100">
          <Image
            src={activeImageUrl}
            alt={product.title}
            fill
            priority
            className="w-full h-full object-center object-contain p-8 mix-blend-multiply"
          />
          <div className="absolute top-3 right-3 z-10">
            <WishlistButton product={{
              id: String(product.id),
              title: product.title,
              price: Number(product.price),
              image: product.image,
              category: product.category // opcional
            }} />
          </div>
        </div>
      </div>

      {/* BLOQUE DERECHO: Información y Selectores Dinámicos */}
      <div className="mt-10 px-4 sm:px-0 sm:mt-16 lg:mt-0">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{product.title}</h1>
        
        <div className="mt-3">
          <p className="text-3xl text-gray-900 font-bold">${product.price.toFixed(2)}</p>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-900">Descripción</h3>
          <p className="mt-2 text-base text-gray-500 leading-relaxed">{product.description}</p>
        </div>

        {/* Selector de Colores (Variantes) */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-900">Color: <span className="font-normal text-gray-500">{selectedVariant.colorName}</span></h3>
          <div className="mt-3 flex items-center gap-x-3">
            {product.variants.map((variant) => (
              <button
                key={variant.articleId}
                onClick={() => handleVariantChange(variant)}
                className={`px-4 py-2 text-sm font-medium rounded-md border transition-all ${
                  selectedVariant.articleId === variant.articleId
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-600 ring-1 ring-indigo-600'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {variant.colorName}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de Talles */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Talles Disponibles</h3>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-4">
            {selectedVariant.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`py-3 px-4 flex items-center justify-center text-sm font-medium uppercase rounded-md border transition-all ${
                  selectedSize === size
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* SECCIÓN INTERACTIVA PREMIUM: CONTROL DE CANTIDAD Y AÑADIR */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 items-end sm:items-center">
          
          {/* Selector numérico de cantidad */}
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
                onClick={handleIncrease}
                className="text-gray-500 hover:text-indigo-600 font-black text-xl p-1 transition-colors select-none"
              >
                +
              </button>
            </div>
          </div>

          {/* Botón de acción principal conectado en bucle */}
          <div className="flex-1 w-full">
            <button
              type="button"
              onClick={() => {
                if (!selectedSize) {
                  alert('Por favor, selecciona un talle antes de añadir al carrito.');
                  return;
                }

                // Inyectamos N veces según la cantidad elegida
                for (let i = 0; i < quantity; i++) {
                  addToCart({
                    id: product.id,
                    articleId: selectedVariant.articleId,
                    title: product.title,
                    price: product.price,
                    colorName: selectedVariant.colorName,
                    size: selectedSize,
                    image: product.image, // FIX SENIOR: Siempre guarda la foto principal frontal
                  });
                }

                alert(`¡Se añadieron ${quantity} unidad(es) al carrito con éxito!`);
                setQuantity(1); // Reseteamos el contador local
              }}
              className="w-full h-14 bg-indigo-600 border border-transparent rounded-lg flex items-center justify-center text-base font-bold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-lg shadow-indigo-600/10"
            >
              Añadir al carrito
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}