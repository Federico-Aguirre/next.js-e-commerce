import React, { useState } from 'react';
import { View, Text, Image, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useWishlistStore } from '@/store/useWishlistStore';
import { useCartStore } from '@/store/useCartStore';
import WishlistButton from '@/components/WishlistButton';

interface WishlistItem {
  id: string;
  title: string;
  price: number;
  image: string;
  category?: string;
}

export default function FavoritesScreen() {
  const wishlist = useWishlistStore((state) => state.wishlist);
  const addToCart = useCartStore((state) => state.addToCart);
  const router = useRouter();

  const [aviso, setAviso] = useState<string | null>(null);

  const handleQuickAdd = (product: WishlistItem) => {
    addToCart({
      id: Number(product.id) || 0,
      articleId: Number(product.id) || 0,
      title: product.title,
      price: product.price,
      image: product.image,
      size: 'M',
      colorName: 'Único',
    });

    setAviso(product.id);
    setTimeout(() => setAviso(null), 2000);
  };

  if (wishlist.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center p-6">
        <View className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm w-full max-w-sm items-center">
          <Text className="text-6xl mb-4">❤️</Text>
          <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
            Tu lista de deseos está vacía
          </Text>
          <Text className="text-gray-500 text-sm mb-6 text-center">
            Guardá los artículos que más te gusten haciendo clic en el corazón
            para tenerlos siempre a mano.
          </Text>
          <Pressable
            onPress={() => router.push('/')}
            className="w-full bg-indigo-600 h-12 rounded-lg items-center justify-center active:bg-indigo-700 shadow-md"
          >
            <Text className="text-sm font-bold text-white">
              Explorar la tienda
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const renderWishlistItem = ({ item }: { item: WishlistItem }) => {
    const imageUrl =
      item.image && item.image.trim() !== ''
        ? item.image
        : 'https://placehold.co/150x150?text=No+Image';

    return (
      <Pressable
        className="flex-1 m-1.5 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm justify-between relative active:opacity-90"
        onPress={() => router.push(`/product/${item.id}`)}
      >
        {/* Botón flotante de favoritos */}
        <View className="absolute top-3 right-3 z-10">
          <WishlistButton product={item} />
        </View>

        <View>
          <View className="h-36 w-full rounded-xl bg-gray-50 items-center justify-center mb-3 p-2">
            <Image
              source={{ uri: imageUrl }}
              className="w-full h-full"
              resizeMode="contain"
            />
          </View>

          <Text className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
            {item.category || 'Colección'}
          </Text>

          <Text
            className="text-xs font-bold text-gray-800 mt-1 h-8"
            numberOfLines={2}
          >
            {item.title}
          </Text>

          <Text className="text-sm font-black text-gray-900 mt-1">
            ${Number(item.price).toFixed(2)}
          </Text>
        </View>

        {/* Botón de compra rápida */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            handleQuickAdd(item);
          }}
          className={`w-full mt-3 h-10 rounded-lg justify-center items-center shadow-sm ${
            aviso === item.id
              ? 'bg-emerald-500'
              : 'bg-gray-900 active:bg-gray-800'
          }`}
        >
          <Text className="text-white text-xs font-bold text-center px-1">
            {aviso === item.id ? '¡Agregado! ✓' : '🛒 Agregar (Talle M)'}
          </Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50"
      edges={['bottom', 'left', 'right']}
    >
      <FlatList
        data={wishlist}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderWishlistItem}
        numColumns={2}
        contentContainerStyle={{ padding: 10, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="px-1.5 pt-2 pb-4">
            <Text className="text-2xl font-black text-gray-900">
              Mi Lista de Deseos
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
