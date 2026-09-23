import React from 'react';
import { View, Text, Image, FlatList, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import SearchBar from '@/components/SearchBar';
import WishlistButton from '@/components/WishlistButton';
import { Product } from '@/types/products';

interface ProductCatalogProps {
  initialProducts?: Product[];
}

export default function ProductCatalog({
  initialProducts = [],
}: ProductCatalogProps) {
  const params = useLocalSearchParams<{ search?: string }>();
  const router = useRouter();
  const queryBusqueda = (params.search as string) || '';

  const productosSeguros = Array.isArray(initialProducts)
    ? initialProducts
    : [];

  const productosFiltrados = productosSeguros.filter((product) =>
    product?.name?.toLowerCase().includes(queryBusqueda.toLowerCase()),
  );

  return (
    <View className="flex-1 bg-gray-50 p-4">
      <SearchBar />

      {productosFiltrados.length === 0 ? (
        <View className="py-12 bg-white rounded-2xl border border-gray-100 p-8 max-w-sm mx-auto shadow-sm items-center mt-6">
          <Text className="text-gray-400 text-3xl mb-2">🔍</Text>
          <Text className="text-sm font-bold text-gray-800">
            No encontramos resultados
          </Text>
          <Text className="text-xs text-gray-500 mt-1 text-center">
            Probá escribiendo otra palabra o limpiando el buscador.
          </Text>
        </View>
      ) : (
        <FlatList
          data={productosFiltrados}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: product }) => {
            if (!product) return null;

            const coverImage =
              product.variants?.[0]?.images?.[0]?.url ||
              'https://via.placeholder.com/150';

            return (
              <Pressable
                onPress={() => router.push(`/product/${product.id}`)}
                className="w-[48%] mb-4 bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm flex-col justify-between"
              >
                <View className="relative w-full h-44 bg-gray-50/50 border-b border-gray-100 items-center justify-center p-2">
                  <Image
                    source={{ uri: coverImage }}
                    className="w-full h-full"
                    resizeMode="contain"
                  />

                  <View className="absolute top-2 right-2 z-30">
                    <WishlistButton
                      product={{
                        id: String(product.id),
                        title: product.name,
                        price: Number(product.price),
                        image: coverImage,
                        category: product.category,
                      }}
                    />
                  </View>
                </View>

                <View className="p-3 flex-1 justify-between bg-white">
                  <View>
                    <Text
                      numberOfLines={2}
                      className="text-xs font-semibold text-gray-800"
                    >
                      {product.name}
                    </Text>
                    <View className="mt-1 bg-gray-50 self-start px-2 py-0.5 rounded">
                      <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                        {product.category}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-3 flex-row items-center justify-between">
                    <Text className="text-base font-black text-gray-900">
                      ${Number(product.price).toFixed(2)}
                    </Text>
                    <View className="rounded-lg bg-gray-900 px-2.5 py-1.5">
                      <Text className="text-[10px] font-bold text-white">
                        Ver
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
