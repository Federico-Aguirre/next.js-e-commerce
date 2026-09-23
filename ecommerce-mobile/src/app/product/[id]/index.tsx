import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { Product } from '@/types/product';
import Navbar from '@/components/Navbar';
import ProductViewer from '@/components/ProductViewer';

const getBaseUrl = (): string => {
  if (!__DEV__) return 'https://next-js-e-commerce-999.vercel.app';
  if (Platform.OS === 'web') return 'http://127.0.0.1:3001';
  if (process.env.EXPO_PUBLIC_BASE_URL) return process.env.EXPO_PUBLIC_BASE_URL;

  const hostUri = Constants.expoConfig?.hostUri;
  const ip = hostUri ? hostUri.split(':')[0] : '192.168.3.2';
  return `http://${ip}:3001`;
};

const API_BASE_URL = getBaseUrl();

export default function ProductDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    async function fetchProduct() {
      if (!id) return;

      const productId = parseInt(id, 10);
      if (isNaN(productId)) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        const query = `
          query GetSingleProduct($id: Int!) {
            product(id: $id) {
              id
              name
              price
              description
              category
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

        const res = await fetch(`${API_BASE_URL}/api/graphql`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { id: productId } }),
        });

        const json = await res.json();
        if (json.data?.product) {
          setProduct(json.data.product as Product);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching single product:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: '#ffffff' }}
        edges={['top', 'left', 'right']}
      >
        <Navbar />
        <View className="flex-1 bg-white justify-center items-center p-4">
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text className="text-gray-500 text-sm mt-3 font-medium">
            Cargando producto...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: '#ffffff' }}
        edges={['top', 'left', 'right']}
      >
        <Navbar />
        <View className="flex-1 bg-white justify-center items-center p-6">
          <Text className="text-5xl mb-3">🔍</Text>
          <Text className="text-lg font-bold text-gray-800 text-center">
            Producto no encontrado
          </Text>
          <Text className="text-gray-500 text-sm text-center mt-1">
            El artículo que estás buscando no existe o ya no está disponible.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      edges={['top', 'left', 'right']}
    >
      <Navbar />
      <ScrollView className="flex-1 bg-white px-4 py-6">
        <View className="max-w-7xl mx-auto w-full pb-12">
          <ProductViewer product={product} baseUrl={API_BASE_URL} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
