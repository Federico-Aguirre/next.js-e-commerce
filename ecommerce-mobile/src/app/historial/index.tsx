import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.3.2:3001';

interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
}

interface Order {
  id: string;
  userId: string;
  total: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export default function HistorialScreen() {
  const [compras, setCompras] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  // Obtenemos la sesión del estado global de Zustand
  const session = useAuthStore((state) => state.session);
  const user = session?.user;

  useEffect(() => {
    async function obtenerHistorial() {
      // Si no hay usuario en Zustand, no realiza la petición HTTP
      if (!user) {
        setErrorMsg('Debes iniciar sesión para ver tus compras.');
        setLoading(false);
        return;
      }

      try {
        console.log('📱 Datos enviados desde Zustand:', {
          id: user?.id,
          email: user?.email,
        });
        const res = await fetch(`${API_BASE_URL}/api/orders`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id || '',
            'x-user-email': user.email || ''
          },
        });

        if (res.ok) {
          const datos: Order[] = await res.json();
          setCompras(datos);
          setErrorMsg(null);
        } else {
          if (res.status === 401) {
            setErrorMsg('Debes iniciar sesión para ver tus compras.');
          } else {
            setErrorMsg('Ocurrió un error al obtener el historial.');
          }
        }
      } catch (error) {
        console.error('Error leyendo historial de la API:', error);
        setErrorMsg('Error de conexión con el servidor.');
      } finally {
        setLoading(false);
      }
    }

    obtenerHistorial();
  }, [user]);

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-4">
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text className="text-gray-500 text-sm font-medium mt-3">
          Cargando tu historial desde la base de datos...
        </Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-4">
        <View className="bg-white border border-gray-100 p-8 rounded-2xl items-center shadow-sm max-w-sm w-full gap-y-4">
          <Text className="text-amber-600 font-bold text-center">⚠️ {errorMsg}</Text>
          <Pressable
            onPress={() => router.push('/login')}
            className="bg-gray-900 px-4 py-3 rounded-lg w-full items-center active:bg-gray-800"
          >
            <Text className="text-white text-sm font-bold">Iniciar sesión</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 py-6">
      <View className="max-w-3xl mx-auto pb-12 gap-y-6">
        <View className="flex-row justify-between items-center">
          <Text className="text-2xl font-black text-gray-900">Mis Compras</Text>
          <Pressable onPress={() => router.push('/')}>
            <Text className="text-sm font-bold text-indigo-600">← Volver a la tienda</Text>
          </Pressable>
        </View>

        {compras.length === 0 ? (
          <View className="bg-white border border-gray-100 p-12 rounded-2xl items-center shadow-sm gap-y-4">
            <Text className="text-gray-400 text-base text-center">
              No tenés compras registradas todavía.
            </Text>
            <Pressable
              onPress={() => router.push('/')}
              className="bg-indigo-600 px-6 h-10 rounded-lg justify-center items-center active:bg-indigo-700 shadow-md"
            >
              <Text className="text-white text-sm font-bold">Ir a comprar</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-y-4">
            {compras.map((compra) => (
              <View
                key={compra.id}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm gap-y-4"
              >
                <View className="flex-row justify-between items-start border-b border-gray-100 pb-3">
                  <View>
                    <Text className="font-bold text-gray-900 text-sm">
                      Orden #{compra.id.slice(-8).toUpperCase()}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      Fecha: {new Date(compra.createdAt).toLocaleDateString('es-AR')}
                    </Text>
                  </View>

                  <View
                    className={`px-3 py-1 rounded-full ${
                      compra.status === 'PAID' ? 'bg-emerald-100' : 'bg-amber-100'
                    }`}
                  >
                    <Text
                      className={`font-bold text-xs ${
                        compra.status === 'PAID' ? 'text-emerald-800' : 'text-amber-800'
                      }`}
                    >
                      {compra.status === 'PAID' ? 'Aprobado' : compra.status}
                    </Text>
                  </View>
                </View>

                <View className="gap-y-2">
                  {compra.items?.map((item: OrderItem) => (
                    <View key={item.id} className="flex-row justify-between items-center">
                      <Text className="text-xs text-gray-600 flex-1 mr-2" numberOfLines={1}>
                        {item.title}{' '}
                        <Text className="text-gray-400 font-medium">x{item.quantity}</Text>
                      </Text>
                      <Text className="text-xs font-semibold text-gray-900">
                        ${(item.price * item.quantity).toLocaleString('es-AR')}
                      </Text>
                    </View>
                  ))}
                </View>

                <View className="flex-row justify-between items-center border-t border-gray-100 pt-3">
                  <Text className="text-xs font-black text-gray-900">Total pagado:</Text>
                  <Text className="text-base font-black text-indigo-600">
                    ${compra.total.toLocaleString('es-AR')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}