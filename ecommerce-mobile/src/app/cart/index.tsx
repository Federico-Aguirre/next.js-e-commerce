import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedFetch } from '@/services/authenticatedFetch';
import {
  checkoutItemsPayload,
  formatCheckoutMoney,
} from '@/services/checkoutShipping';
import { useCheckoutShippingQuotes } from '@/hooks/useCheckoutShippingQuotes';

const DEFAULT_LOCAL_URL = 'http://192.168.3.9.nip.io:3001';
const configuredApiBaseUrl =
  process.env.EXPO_PUBLIC_BASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_API_URL?.trim();
const API_BASE_URL =
  configuredApiBaseUrl?.replace(/\/api\/?$/i, '').replace(/\/+$/, '') ||
  (__DEV__ ? DEFAULT_LOCAL_URL : '');

export default function CartScreen() {
  const cartItems = useCartStore((state) => state.cart);

  // Obtener sesión/usuario desde Zustand
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user) || session?.user;
  const shippingQuoteState = useCheckoutShippingQuotes(
    API_BASE_URL,
    cartItems,
    Boolean(user),
  );
  const selectedShippingQuote = shippingQuoteState.quote;

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleProcessPayment = async () => {
    if (!API_BASE_URL || (!__DEV__ && !API_BASE_URL.startsWith('https://'))) {
      const message =
        'La app necesita una URL HTTPS pública configurada en EXPO_PUBLIC_BASE_URL o EXPO_PUBLIC_API_URL.';
      setCheckoutError(message);
      Alert.alert('Configuración de conexión', message);
      return;
    }

    // 🔍 Extraer ID y Email buscando en las estructuras de NextAuth / JWT
    const targetUserId =
      user?.id ||
      (user as any)?._id ||
      (user as any)?.sub ||
      session?.user?.id ||
      (session?.user as any)?._id ||
      (session?.user as any)?.sub;

    const targetUserEmail = user?.email || session?.user?.email;

    // 1. Validar que exista al menos un ID o Email válido
    if (!targetUserId && !targetUserEmail) {
      Alert.alert(
        'Iniciar Sesión Requerido',
        'Debes iniciar sesión para completar la compra.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Iniciar Sesión', onPress: () => router.push('/login') },
        ],
      );
      return;
    }

    if (!cartItems || cartItems.length === 0) {
      setCheckoutError(
        'No se puede procesar la compra. El carrito está vacío.',
      );
      return;
    }

    setIsProcessing(true);
    setCheckoutError(null);

    try {
      if (!selectedShippingQuote) {
        throw new Error('Primero cotizá y seleccioná una opción de envío.');
      }
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Confirmar total de la compra',
          [
            `Subtotal sin impuestos: ${formatCheckoutMoney(selectedShippingQuote.subtotal, selectedShippingQuote.storeCurrency)}`,
            `${selectedShippingQuote.taxName}${selectedShippingQuote.taxRate ? ` (${selectedShippingQuote.taxRate}%)` : ''}: ${formatCheckoutMoney(selectedShippingQuote.taxAmount, selectedShippingQuote.storeCurrency)}`,
            `Envío (${selectedShippingQuote.carrier}): ${formatCheckoutMoney(selectedShippingQuote.shippingAmount, selectedShippingQuote.storeCurrency)}`,
            `Total final: ${formatCheckoutMoney(selectedShippingQuote.totalInStoreCurrency, selectedShippingQuote.storeCurrency)}`,
            `Importe enviado a Mercado Pago: ${formatCheckoutMoney(selectedShippingQuote.paymentTotal, selectedShippingQuote.paymentCurrency)}`,
          ].join('\n'),
          [
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            { text: 'Confirmar y continuar', onPress: () => resolve(true) },
          ],
          { cancelable: false },
        );
      });
      if (!confirmed) return;

      const payload = {
        items: checkoutItemsPayload(cartItems),
        paymentMethod: 'mercadopago',
        shippingQuoteToken: selectedShippingQuote.quoteToken,
        userId: targetUserId,
        userEmail: targetUserEmail,
        user: {
          id: targetUserId,
          email: targetUserEmail,
        },
      };

      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Error en servidor (${response.status}): ${responseText.slice(0, 120)}`,
        );
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

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 py-6">
      <View className="max-w-4xl mx-auto pb-12">
        <Text className="text-2xl font-black text-gray-900 mb-6">
          Tu Carrito de Compras
        </Text>

        {checkoutError && (
          <View className="mb-6 p-4 bg-red-50 rounded-xl border-l-4 border-red-500 shadow-sm">
            <Text className="text-red-700 text-xs font-semibold">
              ⚠️ {checkoutError}
            </Text>
          </View>
        )}

        <View className="mb-6 space-y-3">
          {cartItems.length === 0 ? (
            <View className="bg-white p-8 rounded-2xl border border-gray-100 items-center shadow-sm">
              <Text className="text-gray-500 font-medium">
                Tu carrito está vacío actualmente.
              </Text>
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
                    <Text
                      className="text-sm font-bold text-gray-900"
                      numberOfLines={1}
                    >
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
          <Text className="text-lg font-black text-gray-900 mb-4">
            Resumen de Compra
          </Text>

          {shippingQuoteState.loading && (
            <View className="flex-row items-center gap-x-2 py-2">
              <ActivityIndicator size="small" />
              <Text className="text-sm text-gray-500">Cotizando el envío…</Text>
            </View>
          )}
          {shippingQuoteState.error && (
            <View className="mb-4 gap-y-2 rounded-lg bg-amber-50 p-3">
              <Text className="text-sm text-amber-900">
                {shippingQuoteState.error}
              </Text>
              <TouchableOpacity onPress={shippingQuoteState.refreshQuotes}>
                <Text className="font-semibold text-amber-900 underline">
                  Volver a cotizar
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {selectedShippingQuote &&
            !shippingQuoteState.loading &&
            !shippingQuoteState.error && (
              <View className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-800">
                  Envío elegido automáticamente · tarifa más económica
                </Text>
                <Text className="font-semibold text-gray-900">
                  {selectedShippingQuote.carrier} ·{' '}
                  {selectedShippingQuote.service}
                </Text>
                <Text className="mt-1 text-xs text-gray-600">
                  {selectedShippingQuote.shippingAmount === 0
                    ? 'Sin costo'
                    : `Envío: ${formatCheckoutMoney(selectedShippingQuote.shippingAmount, selectedShippingQuote.storeCurrency)}`}
                </Text>
              </View>
            )}
          {!shippingQuoteState.loading &&
            !shippingQuoteState.error &&
            selectedShippingQuote && (
              <View className="gap-y-2 border-b border-gray-100 pb-4 mb-6">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-600">
                    Subtotal sin impuestos
                  </Text>
                  <Text className="text-sm font-semibold text-gray-900">
                    {formatCheckoutMoney(
                      selectedShippingQuote.subtotal,
                      selectedShippingQuote.storeCurrency,
                    )}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-600">
                    {selectedShippingQuote.taxName}
                    {selectedShippingQuote.taxRate
                      ? ` (${selectedShippingQuote.taxRate}%)`
                      : ''}
                  </Text>
                  <Text className="text-sm font-semibold text-gray-900">
                    {formatCheckoutMoney(
                      selectedShippingQuote.taxAmount,
                      selectedShippingQuote.storeCurrency,
                    )}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-600">
                    Productos con impuestos
                  </Text>
                  <Text className="text-sm font-semibold text-gray-900">
                    {formatCheckoutMoney(
                      selectedShippingQuote.productTotal,
                      selectedShippingQuote.storeCurrency,
                    )}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-600">Envío</Text>
                  <Text className="text-sm font-semibold text-gray-900">
                    {formatCheckoutMoney(
                      selectedShippingQuote.shippingAmount,
                      selectedShippingQuote.storeCurrency,
                    )}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center border-t border-gray-100 pt-3 mt-1">
                  <Text className="text-base font-black text-gray-900">
                    Total final
                  </Text>
                  <Text className="text-xl font-black text-gray-950">
                    {formatCheckoutMoney(
                      selectedShippingQuote.totalInStoreCurrency,
                      selectedShippingQuote.storeCurrency,
                    )}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">
                  Importe enviado a la pasarela:{' '}
                  {formatCheckoutMoney(
                    selectedShippingQuote.paymentTotal,
                    selectedShippingQuote.paymentCurrency,
                  )}
                </Text>
              </View>
            )}

          <View className="gap-y-3">
            <TouchableOpacity
              disabled={
                isProcessing ||
                cartItems.length === 0 ||
                shippingQuoteState.loading ||
                !selectedShippingQuote ||
                Boolean(shippingQuoteState.error)
              }
              onPress={handleProcessPayment}
              activeOpacity={0.8}
              className="w-full h-12 flex-row items-center justify-center bg-sky-500 rounded-lg shadow-sm"
              style={{
                opacity: isProcessing || cartItems.length === 0 ? 0.5 : 1,
              }}
            >
              {isProcessing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-sm">
                  Pagar con Mercado Pago
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
