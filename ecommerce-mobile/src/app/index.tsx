import React, { useEffect, useState } from 'react';
import {
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import WishlistButton from '@/components/WishlistButton';

const getBaseUrl = (): string => {
  if (!__DEV__) return 'https://next-js-e-commerce-999.vercel.app';

  // Usar el mismo hostname que tiene el navegador actualmente (localhost o IP)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001`;
  }

  if (process.env.EXPO_PUBLIC_BASE_URL) {
    return process.env.EXPO_PUBLIC_BASE_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const ip = hostUri ? hostUri.split(':')[0] : '127.0.0.1';
  return `http://${ip}:3001`;
};

const BASE_URL = getBaseUrl();

// Función auxiliar para agregar el header de ngrok solo si la URL es de ngrok
const getHeaders = (includeContentType = true): Record<string, string> => {
  const headers: Record<string, string> = {};

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  if (BASE_URL.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  return headers;
};

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

const GET_NOVA_CATALOG_QUERY = `
  query GetnovaCatalog {
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
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const triggerAivenWakeUp = async () => {
    try {
      await fetch(`${BASE_URL}/api/aiven-status`, {
        headers: getHeaders(false),
      });
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
        headers: getHeaders(true),
        body: JSON.stringify({ query: GET_NOVA_CATALOG_QUERY }),
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

  const getProductImage = (product: Product): string => {
    const firstVariantWithImage = product.variants?.find((v) => v.images && v.images.length > 0);
    const rawUrl = firstVariantWithImage?.images[0]?.url;

    if (!rawUrl) return 'https://via.placeholder.com/300';
    return rawUrl.startsWith('http') ? rawUrl : `${BASE_URL}${rawUrl}`;
  };

  const renderProductCard = ({ item }: { item: Product }) => {
    const imageUrl = getProductImage(item);

    return (
      <Pressable
        className="flex-1 m-1.5 bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm flex-col justify-between active:opacity-90"
        onPress={() => router.push(`/product/${item.id}`)}
      >
        {/* Contenedor de Imagen + Wishlist */}
        <View className="relative w-full h-40 bg-gray-50 items-center justify-center p-3 border-b border-gray-100">
          <Image
            source={{ uri: imageUrl }}
            className="w-full h-full"
            resizeMode="contain"
          />

          {/* Componente oficial de Wishlist móvil */}
          <View className="absolute top-2 right-2 z-10">
            <WishlistButton
              product={{
                id: String(item.id),
                title: item.name,
                price: Number(item.price),
                image: imageUrl,
                category: item.category,
              }}
            />
          </View>
        </View>

        {/* Información del Producto */}
        <View className="p-3 flex-1 justify-between bg-white">
          <View>
            <Text className="text-xs font-semibold text-gray-800" numberOfLines={2}>
              {item.name}
            </Text>
            <View className="mt-1.5 self-start bg-gray-50 px-2 py-0.5 rounded">
              <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                {item.category}
              </Text>
            </View>
          </View>

          {/* Precio */}
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-sm font-black text-gray-900">
              ${Number(item.price).toFixed(2)}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Encabezado */}
      <View className="py-4 px-4 bg-white border-b border-gray-100 items-center">
        <Text className="text-2xl font-extrabold text-gray-900">Nuestra Colección</Text>
        <Text className="text-sm text-gray-500 mt-1">Ropa exclusiva diseñada para durar.</Text>
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
          <TouchableOpacity className="bg-indigo-600 px-4 py-2 rounded-md" onPress={fetchProducts}>
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
          numColumns={2}
          contentContainerStyle={{ padding: 10 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}