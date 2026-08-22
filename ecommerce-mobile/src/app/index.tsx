import React, { useEffect, useState } from 'react';
import {
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = 'https://next-js-e-commerce-999.vercel.app';

interface ImageItem {
  id: string;
  url: string;
}

interface Sku {
  id: string;
  articleId: string;
  size: string;
  stock: number;
}

interface Variant {
  id: string;
  colorName: string;
  images: ImageItem[];
  skus: Sku[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  variants: Variant[];
}

const GET_SENIOR_CATALOG_QUERY = `
  query GetSeniorCatalog {
    products {
      id
      name
      price
      category
      description
      variants {
        id
        colorName
        images {
          id
          url
        }
        skus {
          id
          articleId
          size
          stock
        }
      }
    }
  }
`;

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const triggerAivenWakeUp = async () => {
    try {
      // Se eliminó { cache: 'no-store' } que provocaba el TypeError en React Native
      await fetch(`${BASE_URL}/api/aiven-status`);
    } catch (err) {
      console.error('Error al intentar despertar Aiven:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      await triggerAivenWakeUp();

      const res = await fetch(`${BASE_URL}/api/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: GET_SENIOR_CATALOG_QUERY }),
      });

      if (!res.ok) throw new Error(`Error en el servidor: ${res.status}`);

      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0]?.message || 'Error en GraphQL');

      setProducts(json.data?.products || []);
    } catch (err: any) {
      console.error('Error fetching from GraphQL:', err);
      setError('No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Formatea URLs relativas (/uploads/...) a URLs absolutas completas para React Native
  const getProductImage = (product: Product): string => {
    const firstVariantWithImage = product.variants?.find(
      (v) => v.images && v.images.length > 0
    );
    const rawUrl = firstVariantWithImage?.images[0]?.url;

    if (!rawUrl) return 'https://via.placeholder.com/300';
    return rawUrl.startsWith('http') ? rawUrl : `${BASE_URL}${rawUrl}`;
  };

  const renderProductCard = ({ item }: { item: Product }) => {
    const imageUrl = getProductImage(item);

    return (
      <View className="bg-white rounded-xl mb-4 overflow-hidden border border-gray-200 shadow-sm">
        <Image source={{ uri: imageUrl }} className="w-full h-60" resizeMode="cover" />
        <View className="p-4">
          <Text className="text-xs font-bold text-indigo-600 tracking-wider mb-1 uppercase">
            {item.category}
          </Text>
          <Text className="text-lg font-bold text-gray-900 mb-1">{item.name}</Text>
          <Text className="text-base font-semibold text-emerald-600 mb-3">
            ${item.price.toLocaleString()}
          </Text>

          <TouchableOpacity
            className="bg-gray-900 py-3 rounded-lg items-center active:opacity-80"
            onPress={() => alert(`Añadido: ${item.name}`)}
          >
            <Text className="text-white font-semibold text-sm">Agregar al Carrito</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Encabezado */}
      <View className="py-5 px-4 bg-white border-b border-gray-100 items-center">
        <Text className="text-2xl font-extrabold text-gray-900">Nuestra Colección</Text>
        <Text className="text-sm text-gray-500 mt-1">
          Ropa exclusiva diseñada para durar.
        </Text>
      </View>

      {/* Estados de interfaz */}
      {loading ? (
        <View className="flex-1 justify-center items-center p-5">
          <ActivityIndicator size="large" color="#111827" />
          <Text className="mt-3 text-gray-500 text-sm">
            Iniciando servidores y cargando tienda...
          </Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center p-5">
          <Text className="text-red-500 text-sm mb-3 text-center">{error}</Text>
          <TouchableOpacity
            className="bg-indigo-600 px-4 py-2 rounded-md"
            onPress={fetchProducts}
          >
            <Text className="text-white font-semibold">Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : products.length === 0 ? (
        <View className="flex-1 justify-center items-center p-5">
          <Text className="text-gray-500 text-sm">
            No hay productos disponibles por el momento.
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProductCard}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}