import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCartStore } from '@/store/useCartStore';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.3.2:3001';

export default function SuccessScreen() {
  const clearCart = useCartStore((state) => state.clearCart);
  const router = useRouter();
  const searchParams = useLocalSearchParams<{
    payment_id?: string;
    status?: string;
  }>();

  const [guardando, setGuardando] = useState(true);
  const [errorVerificacion, setErrorVerificacion] = useState(false);
  const ordenProcesada = useRef(false);

  const paymentId = Array.isArray(searchParams.payment_id)
    ? searchParams.payment_id[0]
    : searchParams.payment_id;
  const status = Array.isArray(searchParams.status)
    ? searchParams.status[0]
    : searchParams.status;

  useEffect(() => {
    async function confirmOrder() {
      if (status === 'approved' && paymentId && !ordenProcesada.current) {
        ordenProcesada.current = true;

        try {
          const res = await fetch(`${API_BASE_URL}/api/orders/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId }),
          });

          if (!res.ok) throw new Error('Falló la confirmación de la orden');

          await AsyncStorage.removeItem('last_pending_order_id');
          clearCart();
        } catch (error) {
          console.error('Error guardando orden:', error);
          setErrorVerificacion(true);
        } finally {
          setGuardando(false);
        }
      } else {
        setGuardando(false);
      }
    }

    confirmOrder();
  }, [paymentId, status, clearCart]);

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      className="bg-gray-50 p-4 justify-center items-center"
    >
      <View className="bg-white max-w-md w-full p-8 rounded-2xl shadow-md border border-gray-100 items-center gap-y-6">
        {errorVerificacion ? (
          <>
            <Text className="text-6xl">❌</Text>
            <Text className="text-2xl font-black text-gray-900 text-center">
              Error de Verificación
            </Text>
          </>
        ) : (
          <>
            <Text className="text-6xl">✅</Text>
            <Text className="text-2xl font-black text-gray-900 text-center">
              ¡Muchas gracias por tu compra!
            </Text>
            {guardando ? (
              <ActivityIndicator color="#4f46e5" />
            ) : (
              <Text className="text-gray-500 text-sm">
                Comprobante N°: {paymentId || 'N/A'}
              </Text>
            )}
          </>
        )}

        <Pressable
          onPress={() => router.push('/historial')}
          className="w-full bg-indigo-600 h-12 rounded-lg justify-center items-center"
        >
          <Text className="text-sm font-bold text-white">Ver mi historial</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
