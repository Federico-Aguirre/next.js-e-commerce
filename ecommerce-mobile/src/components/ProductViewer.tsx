import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Product, ProductVariant, ProductSku } from '@/types/product';
import { useCartStore } from '@/store/useCartStore';
import WishlistButton from '@/components/WishlistButton';

interface ProductViewerProps {
  product: Product;
  baseUrl?: string;
}

export default function ProductViewer({
  product,
  baseUrl = '',
}: ProductViewerProps) {
  const addToCart = useCartStore((state) => state.addToCart);
  const cart = useCartStore((state) => state.cart);

  const formatImageUrl = (url?: string): string => {
    if (!url || url.trim() === '') return 'https://via.placeholder.com/300';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    product.variants?.[0] || {
      id: '',
      colorName: 'Default',
      skus: [],
      images: [],
    },
  );

  const [activeImageUrl, setActiveImageUrl] = useState<string>(
    selectedVariant.images?.[0]?.url || '',
  );

  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const stockDisponible = selectedSku ? Number(selectedSku.stock || 0) : 0;

  const handleVariantChange = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setActiveImageUrl(variant.images?.[0]?.url || '');
    setSelectedSku(null);
    setQuantity(1);
  };

  const handleDecrease = () => {
    if (quantity > 1) setQuantity((prev) => prev - 1);
  };

  const handleIncrease = () => {
    if (selectedSku && quantity < stockDisponible) {
      setQuantity((prev) => prev + 1);
    }
  };

  const handleAddToCart = () => {
    if (!selectedSku) return;

    const itemEnCarrito = cart.find(
      (item: any) =>
        item.articleId === selectedSku.articleId &&
        item.size === selectedSku.size,
    );
    const cantidadActual = itemEnCarrito
      ? Number(itemEnCarrito.quantity || 0)
      : 0;

    if (cantidadActual + quantity > stockDisponible) {
      Alert.alert(
        'Stock insuficiente',
        `No puedes agregar más unidades. Ya tienes ${cantidadActual} en el carrito.`,
      );
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
        image: formatImageUrl(selectedVariant.images?.[0]?.url),
        category: product.category,
      } as any);
    }

    Alert.alert(
      '¡Producto agregado!',
      `Se añadieron ${quantity} unidad(es) al carrito.`,
    );
    setQuantity(1);
  };

  return (
    <View className="gap-y-6 pb-10">
      {/* Visor Principal e Imagen */}
      <View className="w-full h-80 bg-gray-50 rounded-2xl overflow-hidden relative border border-gray-100 items-center justify-center p-4">
        {Boolean(activeImageUrl) && (
          <Image
            source={{ uri: formatImageUrl(activeImageUrl) }}
            className="w-full h-full"
            resizeMode="contain"
          />
        )}

        <View className="absolute top-3 right-3 z-10">
          <WishlistButton
            product={{
              id: String(product.id),
              title: product.name,
              price: Number(product.price || 0),
              image: formatImageUrl(selectedVariant?.images?.[0]?.url),
              category: product.category,
            }}
          />
        </View>
      </View>

      {/* Galería Miniaturas */}
      {Boolean(
        selectedVariant?.images && selectedVariant.images.length > 1,
      ) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row gap-x-3"
        >
          {selectedVariant.images.map((img) => (
            <TouchableOpacity
              key={img.id}
              activeOpacity={0.7}
              onPress={() => setActiveImageUrl(img.url)}
              className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden border-2 justify-center items-center mr-3"
              style={{
                borderColor: activeImageUrl === img.url ? '#4f46e5' : '#e5e7eb',
              }}
            >
              <Image
                source={{ uri: formatImageUrl(img.url) }}
                className="w-full h-full"
                resizeMode="contain"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Info Principal */}
      <View className="gap-y-2">
        <Text className="text-2xl font-extrabold text-gray-900">
          {product.name}
        </Text>
        <Text className="text-2xl font-bold text-gray-900">
          ${Number(product.price || 0).toFixed(2)}
        </Text>
      </View>

      {/* Descripción */}
      <View className="gap-y-1">
        <Text className="text-xs font-semibold text-gray-900">Descripción</Text>
        <Text className="text-sm text-gray-500 leading-relaxed">
          {product.description}
        </Text>
      </View>

      {/* Selector de Color */}
      <View className="gap-y-2">
        <Text className="text-xs font-semibold text-gray-900">
          Color:{' '}
          <Text className="font-normal text-gray-500">
            {selectedVariant?.colorName}
          </Text>
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {product.variants?.map((variant) => {
            const isSelected = selectedVariant?.id === variant.id;
            return (
              <TouchableOpacity
                key={variant.id}
                activeOpacity={0.7}
                onPress={() => handleVariantChange(variant)}
                className="px-4 py-2 rounded-lg border"
                style={{
                  borderColor: isSelected ? '#4f46e5' : '#d1d5db',
                  backgroundColor: isSelected ? '#eef2ff' : '#ffffff',
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: isSelected ? '#4f46e5' : '#374151' }}
                >
                  {variant.colorName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Selector de Talle */}
      <View className="gap-y-2">
        <Text className="text-xs font-semibold text-gray-900">
          Talles Disponibles
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {selectedVariant?.skus?.map((sku) => {
            const currentStock = Number(sku.stock || 0);
            const hasStock = currentStock > 0;
            const isSelected = selectedSku?.id === sku.id;

            return (
              <TouchableOpacity
                key={sku.id}
                disabled={!hasStock}
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedSku(sku);
                  setQuantity(1);
                }}
                className="w-14 h-12 rounded-lg border items-center justify-center"
                style={{
                  backgroundColor: !hasStock
                    ? '#f3f4f6'
                    : isSelected
                      ? '#4f46e5'
                      : '#ffffff',
                  borderColor: !hasStock
                    ? '#e5e7eb'
                    : isSelected
                      ? '#4f46e5'
                      : '#e5e7eb',
                }}
              >
                <Text
                  className="text-xs font-bold uppercase"
                  style={{
                    color: !hasStock
                      ? '#9ca3af'
                      : isSelected
                        ? '#ffffff'
                        : '#111827',
                    textDecorationLine: !hasStock ? 'line-through' : 'none',
                  }}
                >
                  {sku.size}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {Boolean(selectedSku) && (
          <Text className="text-xs font-medium text-emerald-600 mt-1">
            {`✓ ¡Disponible! Quedan ${stockDisponible} unidades en stock.`}
          </Text>
        )}
      </View>

      {/* Controles de Compra */}
      <View className="gap-y-4 pt-2">
        <View className="flex-row items-center justify-between border border-gray-200 rounded-xl bg-gray-50 h-14 px-4">
          <Text className="text-xs font-bold text-gray-400 uppercase">
            Cantidad
          </Text>
          <View className="flex-row items-center gap-x-4">
            <TouchableOpacity
              onPress={handleDecrease}
              activeOpacity={0.7}
              className="p-1"
            >
              <Text className="text-2xl font-black text-gray-700 px-2">−</Text>
            </TouchableOpacity>

            <Text className="text-base font-bold text-gray-800 w-6 text-center">
              {String(quantity)}
            </Text>

            <TouchableOpacity
              disabled={!selectedSku || quantity >= stockDisponible}
              activeOpacity={0.7}
              onPress={handleIncrease}
              className="p-1"
            >
              <Text
                className="text-2xl font-black px-2"
                style={{
                  color:
                    !selectedSku || quantity >= stockDisponible
                      ? '#d1d5db'
                      : '#4f46e5',
                }}
              >
                +
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          disabled={!selectedSku}
          activeOpacity={0.8}
          onPress={handleAddToCart}
          className="w-full h-14 rounded-xl items-center justify-center shadow-md"
          style={{
            backgroundColor: !selectedSku ? '#d1d5db' : '#4f46e5',
          }}
        >
          <Text className="text-white text-base font-bold">
            {!selectedSku ? 'Selecciona un talle' : 'Añadir al carrito'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
