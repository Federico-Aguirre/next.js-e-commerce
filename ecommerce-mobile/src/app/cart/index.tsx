import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';

const DEFAULT_LOCAL_URL = 'http://192.168.3.9.nip.io:3001';
const API_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || DEFAULT_LOCAL_URL;

export default function CartScreen() {
  const cartItems = useCartStore((state) => state.cart);
  const getCartTotal = useCartStore((state) => state.getCartTotal);
  
  // Obtener sesión/usuario desde Zustand
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user) || session?.user;

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleProcessPayment = async (paymentMethod: 'mercadopago' | 'stripe') => {
    // 🔍 Extraer ID y Email buscando en las estructuras de NextAuth / JWT
    const targetUserId =
      user?.id ||
      (user as any)?._id ||
      (user as any)?.sub ||
      session?.user?.id ||
      (session?.user as any)?._id ||
      (session?.user as any)?.sub;

    const targetUserEmail = user?.email || session?.user?.email;

    console.log('📱 [MOBILE-CART] Intentando checkout con:', {
      targetUserId,
      targetUserEmail,
      rawUser: user,
    });

    // 1. Validar que exista al menos un ID o Email válido
    if (!targetUserId && !targetUserEmail) {
      Alert.alert(
        'Iniciar Sesión Requerido',
        'Debes iniciar sesión para completar la compra.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Iniciar Sesión', onPress: () => router.push('/login') },
        ]
      );
      return;
    }

    if (!cartItems || cartItems.length === 0) {
      setCheckoutError('No se puede procesar la compra. El carrito está vacío.');
      return;
    }

    setIsProcessing(true);
    setCheckoutError(null);

    try {
      const payload = {
        items: cartItems,
        paymentMethod,
        userId: targetUserId,
        userEmail: targetUserEmail,
        user: {
          id: targetUserId,
          email: targetUserEmail,
        },
      };

      const response = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Error en servidor (${response.status}): ${responseText.slice(0, 120)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar la sesión de pago.');
      }

      if (data.url) {
        await Linking.openURL(data.url);
      } else {
        throw new Error('Respuesta inválida. Falta la URL de redirección.');
      }
    } catch (error: any) {
      console.error('Error en checkout:', error);
      const msg = error?.message || 'Ocurrió un error de red inesperado.';
      setCheckoutError(msg);
      Alert.alert('Error en Checkout', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const cartTotal = getCartTotal();

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 py-6">
      <View className="max-w-4xl mx-auto pb-12">
        <Text className="text-2xl font-black text-gray-900 mb-6">Tu Carrito de Compras</Text>

        {checkoutError && (
          <View className="mb-6 p-4 bg-red-50 rounded-xl border-l-4 border-red-500 shadow-sm">
            <Text className="text-red-700 text-xs font-semibold">⚠️ {checkoutError}</Text>
          </View>
        )}

        <View className="mb-6 space-y-3">
          {cartItems.length === 0 ? (
            <View className="bg-white p-8 rounded-2xl border border-gray-100 items-center shadow-sm">
              <Text className="text-gray-500 font-medium">Tu carrito está vacío actualmente.</Text>
            </View>
          ) : (
            cartItems.map((item) => (
              <View
                key={`${item.articleId}-${item.size}`}
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex-row items-center justify-between mb-3"
              >
                <View className="flex-row items-center flex-1 pr-2">
                  <View className="w-16 h-16 bg-gray-50 rounded-xl p-1 border border-gray-100 mr-3 items-center justify-center">
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        className="w-full h-full"
                        resizeMode="contain"
                      />
                    ) : (
                      <View className="w-full h-full bg-gray-200 rounded-lg" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-1">
                      Talle: {item.size} | Cant: {item.quantity}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm font-black text-gray-950">
                  ${(item.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <Text className="text-lg font-black text-gray-900 mb-4">Resumen de Compra</Text>

          <View className="flex-row justify-between items-center border-b border-gray-100 pb-4 mb-6">
            <Text className="text-sm font-medium text-gray-500">Monto Total:</Text>
            <Text className="text-xl font-black text-gray-950">${cartTotal.toFixed(2)}</Text>
          </View>

          <View className="gap-y-3">
            <TouchableOpacity
              disabled={isProcessing || cartItems.length === 0}
              onPress={() => handleProcessPayment('mercadopago')}
              activeOpacity={0.8}
              className="w-full h-12 flex-row items-center justify-center bg-sky-500 rounded-lg shadow-sm"
              style={{ opacity: isProcessing || cartItems.length === 0 ? 0.5 : 1 }}
            >
              {isProcessing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-sm">Pagar con Mercado Pago</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              disabled={isProcessing || cartItems.length === 0}
              onPress={() => handleProcessPayment('stripe')}
              activeOpacity={0.8}
              className="w-full h-12 flex-row items-center justify-center bg-indigo-600 rounded-lg shadow-sm"
              style={{ opacity: isProcessing || cartItems.length === 0 ? 0.5 : 1 }}
            >
              {isProcessing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-sm">Pagar con Stripe</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}