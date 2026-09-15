import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore'; // <-- Importamos el store de autenticación

function CartCounter() {
  const cartCount = useCartStore((state) => state.getCartCount());
  if (cartCount === 0) return null;

  return (
    <View className="absolute -top-1 -right-2 w-5 h-5 bg-indigo-600 rounded-full items-center justify-center">
      <Text className="text-white text-xs font-bold">{cartCount}</Text>
    </View>
  );
}

export default function Navbar() {
  const router = useRouter();

  // Leemos el estado global de zustand
  const session = useAuthStore((state) => state.session);
  const status = useAuthStore((state) => state.status);
  const logout = useAuthStore((state) => state.logout);

  const isLoading = status === 'loading';
  const user = session?.user;

  const handleLogout = async () => {
    // Cerramos sesión limpiando el estado global
    logout();
    router.replace('/');
  };

  return (
    <View className="bg-white border-b border-gray-100 shadow-sm">
      {/* FILA PRINCIPAL: LOGO Y ACCIONES */}
      <View className="flex-row items-center justify-between h-12 mx-5">
        {/* LOGO */}
        <Pressable onPress={() => router.push('/')}>
          <Text className="text-xl font-black tracking-tight text-gray-900">
            NOVA<Text className="text-indigo-600">STORE</Text>
          </Text>
        </Pressable>

        {/* ACCIONES DERECHA */}
        <View className="flex-row items-center gap-x-4">
          {/* BOTÓN CARRITO */}
          <Pressable onPress={() => router.push('/checkout')} className="relative p-1" hitSlop={8}>
            <Feather name="shopping-bag" size={22} color="#6b7280" />
            <CartCounter />
          </Pressable>

          {/* SEPARADOR */}
          <View className="h-4 w-px bg-gray-200" />

          {/* AUTENTICACIÓN */}
          {isLoading ? (
            <Text className="text-xs text-gray-400">...</Text>
          ) : user ? (
            <View className="flex-row items-center gap-x-2">
              <Text className="text-xs font-semibold text-gray-700">
                Hola <Text className="text-indigo-600">{user.name?.split(' ')[0] || 'Comprador'}</Text>
              </Text>

              <Pressable onPress={handleLogout} className="bg-red-50 px-2 py-1 rounded-md">
                <Text className="text-[11px] font-bold text-red-500">Salir</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => router.push('/login')}>
              <Text className="text-xs font-bold text-gray-700">Ingresar</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* FILA DE NAVEGACIÓN INFERIOR (DESLIZABLE EN PANTALLAS PEQUEÑAS) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 20, paddingTop: 4, paddingBottom: 4 }}
        className="mx-5"
      >
        <Pressable onPress={() => router.push('/')}>
          <Text className="text-xs font-medium text-gray-500">Catálogo</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/favorites')}>
          <Text className="text-xs font-medium text-gray-500">Lista de deseos</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/historial')}>
          <Text className="text-xs font-medium text-gray-500">Mis Compras</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}