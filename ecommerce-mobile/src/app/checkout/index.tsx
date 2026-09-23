import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCartStore, CartItem } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useUserStore } from '@/store/useUserStore';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.3.2:3001';

export default function CheckoutScreen() {
  const { cart, addToCart, removeFromCart, getCartTotal } = useCartStore();
  const searchParams = useLocalSearchParams();
  const router = useRouter();

  // 🔍 OBTENCIÓN DE SESIÓN/USUARIO DESDE ZUSTAND
  const authSession = useAuthStore((state) => state.session);
  const authUser = useAuthStore((state) => state.user);
  const storeUser = useUserStore((state) => state.user);
  const currentUser = authUser || storeUser || authSession?.user;

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // 💳 ESTADO PARA FORMULARIO NATIVO DE MERCADO PAGO
  const [showMpForm, setShowMpForm] = useState<boolean>(false);
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardholderName: '',
    expirationMonth: '',
    expirationYear: '',
    securityCode: '',
    identificationNumber: '12345678',
  });

  // 🛡️ Previene ejecuciones fantasmas o clics dobles rápidos
  const isNavigating = useRef<boolean>(false);

  const subtotal = getCartTotal();
  const shipping = subtotal > 0 ? 15.0 : 0.0;
  const total = subtotal + shipping;

  // ⚡ HELPER: Cargar datos de prueba de Mercado Pago al instante
  const handleFillTestData = () => {
    setCardData({
      cardNumber: '4509 9535 6623 3704',
      cardholderName: 'APRO',
      expirationMonth: '11',
      expirationYear: '28',
      securityCode: '123',
      identificationNumber: '12345678',
    });
  };

  // ⚡ HELPER: Tokenizar tarjeta directamente en Mercado Pago desde React Native
  const obtenerTokenTarjeta = async () => {
    const publicKey = process.env.EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

    if (!publicKey) {
      throw new Error(
        'Falta configurar EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY en tus variables de entorno.',
      );
    }

    const response = await fetch(
      `https://api.mercadopago.com/v1/card_tokens?public_key=${publicKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          card_number: cardData.cardNumber.replace(/\s+/g, ''),
          security_code: cardData.securityCode,
          expiration_month: Number(cardData.expirationMonth),
          expiration_year: Number(`20${cardData.expirationYear.slice(-2)}`),
          cardholder: {
            name: cardData.cardholderName,
            identification: {
              type: 'DNI',
              number: cardData.identificationNumber || '12345678',
            },
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok || !data.id) {
      console.error('Error al tokenizar en Mercado Pago:', data);
      throw new Error(
        data?.cause?.[0]?.description ||
          'Datos de tarjeta inválidos o incompletos.',
      );
    }

    return data.id;
  };

  const handleProcessPayment = async (
    paymentMethod: 'mercadopago' | 'stripe',
  ) => {
    if (isNavigating.current) return;

    const targetUserId =
      currentUser?.id || (currentUser as any)?._id || (currentUser as any)?.sub;
    const targetUserEmail = currentUser?.email;

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

    setIsProcessing(true);
    setCheckoutError(null);
    isNavigating.current = true;

    try {
      const itemsPayload = cart.map((item) => ({
        productId: String(item.articleId || (item as any).productId || item.id),
        title: item.title,
        price: Number(item.price),
        quantity: Number(item.quantity),
        image: item.image,
        size: item.size,
      }));

      // =========================================================
      // 💳 OPCIÓN A: MERCADO PAGO DIRECTO EN LA APP (API)
      // =========================================================
      if (paymentMethod === 'mercadopago') {
        const cardToken = await obtenerTokenTarjeta();

        const response = await fetch(`${API_BASE_URL}/api/payment/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            items: itemsPayload,
            token: cardToken,
            paymentMethodId: 'visa',
            installments: 1,
            userId: targetUserId,
            userEmail: targetUserEmail,
            user: { id: targetUserId, email: targetUserEmail },
          }),
        });

        const responseText = await response.text();

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error('❌ EL SERVIDOR DEVOLVIÓ HTML EN LUGAR DE JSON:');
          console.error('STATUS CODE:', response.status);
          console.error('CONTENIDO:', responseText.slice(0, 300));
          throw new Error(
            `Error en el servidor (${response.status}). Revisa la consola.`,
          );
        }

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || 'El pago no pudo ser procesado por Mercado Pago.',
          );
        }

        router.push(`/checkout/success?orderId=${data.orderId}`);
        return;
      }

      // =========================================================
      // 💳 OPCIÓN B: STRIPE (REDIRECCIÓN WEB)
      // =========================================================
      if (paymentMethod === 'stripe') {
        const savedOrderId = await AsyncStorage.getItem(
          'last_pending_order_id',
        );
        if (savedOrderId) {
          await fetch(`${API_BASE_URL}/api/checkout`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: savedOrderId }),
          }).catch(() => {});
          await AsyncStorage.removeItem('last_pending_order_id');
        }

        const response = await fetch(`${API_BASE_URL}/api/checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            items: itemsPayload,
            paymentMethod: 'stripe',
            userId: targetUserId,
            userEmail: targetUserEmail,
            user: { id: targetUserId, email: targetUserEmail },
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error en la pasarela Stripe.');
        }

        if (data.orderId) {
          await AsyncStorage.setItem('last_pending_order_id', data.orderId);
        }

        if (data.url) {
          await Linking.openURL(data.url);
        } else {
          throw new Error('Falta el enlace de redirección.');
        }
      }
    } catch (error: unknown) {
      console.error('❌ Fallo en el pago:', error);
      if (error instanceof Error) {
        setCheckoutError(error.message);
      } else {
        setCheckoutError('Error de red al intentar pagar.');
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        isNavigating.current = false;
      }, 2000);
    }
  };

  const handleDecreaseQuantity = (item: CartItem) => {
    const currentId = item.articleId || (item as any).productId || item.id;
    if (item.quantity > 1) {
      useCartStore.setState((state) => ({
        cart: state.cart.map((cartItem) => {
          const cartItemId =
            cartItem.articleId || (cartItem as any).productId || cartItem.id;
          return cartItemId === currentId && cartItem.size === item.size
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem;
        }),
      }));
    } else {
      removeFromCart(currentId, item.size);
    }
  };

  if (cart.length === 0) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-6">
        <View className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm w-full max-w-sm items-center">
          <Text className="text-5xl mb-4">🛒</Text>
          <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
            Tu carrito está vacío
          </Text>
          <Text className="text-gray-500 text-sm mb-6 text-center">
            Parece que aún no has agregado ningún producto.
          </Text>
          <Pressable
            onPress={() => router.push('/')}
            className="w-full bg-indigo-600 py-3 rounded-lg items-center active:bg-indigo-700 shadow-md"
          >
            <Text className="text-sm font-bold text-white">
              Volver al catálogo
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 py-6">
      <View className="max-w-4xl mx-auto pb-12 gap-y-6">
        <Text className="text-2xl font-black text-gray-900">
          Tu Carrito de Compras
        </Text>

        {checkoutError && (
          <View className="p-4 bg-red-50 rounded-xl border-l-4 border-red-500 shadow-sm">
            <Text className="text-red-700 text-xs font-semibold">
              ⚠️ {checkoutError}
            </Text>
          </View>
        )}

        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 gap-y-4">
          {cart.map((item) => {
            const itemRealId =
              item.articleId || (item as any).productId || item.id;
            const imageUrl =
              item.image && item.image.trim() !== ''
                ? item.image
                : 'https://placehold.co/150x150?text=No+Image';

            return (
              <View
                key={`${itemRealId}-${item.size}`}
                className="flex-row items-center border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
              >
                <View className="h-20 w-20 bg-gray-50 rounded-xl border border-gray-100 p-1 mr-3 justify-center items-center">
                  <Image
                    source={{ uri: imageUrl }}
                    className="w-full h-full"
                    resizeMode="contain"
                  />
                </View>
                <View className="flex-1 justify-between gap-y-1">
                  <Text
                    className="text-sm font-bold text-gray-800"
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text className="text-xs text-gray-400 font-semibold">
                    Talle:{' '}
                    <Text className="text-gray-600 font-normal uppercase">
                      {item.size}
                    </Text>
                  </Text>
                  <View className="flex-row items-center justify-between mt-2">
                    <View className="flex-row items-center border border-gray-200 rounded-md bg-gray-50">
                      <Pressable
                        onPress={() => handleDecreaseQuantity(item)}
                        className="px-3 py-1 active:bg-gray-200 rounded-l-md"
                      >
                        <Text className="text-gray-600 font-bold text-base">
                          −
                        </Text>
                      </Pressable>
                      <Text className="px-2 text-sm font-bold text-gray-800 min-w-6 text-center">
                        {item.quantity}
                      </Text>
                      <Pressable
                        onPress={() => addToCart(item)}
                        className="px-3 py-1 active:bg-gray-200 rounded-r-md"
                      >
                        <Text className="text-gray-600 font-bold text-base">
                          +
                        </Text>
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => removeFromCart(itemRealId, item.size)}
                      className="p-1"
                    >
                      <Text className="text-xs font-semibold text-red-500">
                        Eliminar
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <Text className="text-sm font-black text-gray-900 ml-2">
                  ${(item.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            );
          })}
        </View>

        <View className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm gap-y-4">
          <Text className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
            Resumen del pedido
          </Text>
          <View className="gap-y-2 text-sm">
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-600 text-sm">Subtotal</Text>
              <Text className="font-semibold text-gray-900 text-sm">
                ${subtotal.toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-600 text-sm">
                Costo de envío estimado
              </Text>
              <Text className="font-semibold text-gray-900 text-sm">
                ${shipping.toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between items-center border-t border-gray-100 pt-3 mt-1">
              <Text className="font-black text-gray-900 text-base">Total</Text>
              <Text className="font-black text-gray-900 text-xl">
                ${total.toFixed(2)}
              </Text>
            </View>
          </View>

          {showMpForm ? (
            <View className="border-t border-gray-100 pt-4 gap-y-3">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-bold text-sky-600 uppercase">
                  Tarjeta de Crédito / Débito
                </Text>
                <Pressable
                  onPress={handleFillTestData}
                  className="bg-sky-50 px-2 py-1 rounded"
                >
                  <Text className="text-xs text-sky-600 font-bold">
                    ⚡ Usar Tarjeta APRO
                  </Text>
                </Pressable>
              </View>

              <View>
                <Text className="text-xs font-bold text-gray-600 mb-1">
                  Número de Tarjeta
                </Text>
                <TextInput
                  placeholder="4509 9535 6623 3704"
                  value={cardData.cardNumber}
                  onChangeText={(text) =>
                    setCardData({ ...cardData, cardNumber: text })
                  }
                  keyboardType="numeric"
                  className="w-full text-sm p-3 border border-gray-200 rounded-lg text-gray-800 bg-gray-50"
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-gray-600 mb-1">
                  Nombre del Titular
                </Text>
                <TextInput
                  placeholder="APRO"
                  value={cardData.cardholderName}
                  onChangeText={(text) =>
                    setCardData({ ...cardData, cardholderName: text })
                  }
                  className="w-full text-sm p-3 border border-gray-200 rounded-lg text-gray-800 bg-gray-50"
                />
              </View>

              <View className="flex-row gap-x-2">
                <View className="flex-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1">
                    Mes (MM)
                  </Text>
                  <TextInput
                    placeholder="11"
                    maxLength={2}
                    keyboardType="numeric"
                    value={cardData.expirationMonth}
                    onChangeText={(text) =>
                      setCardData({ ...cardData, expirationMonth: text })
                    }
                    className="w-full text-sm p-3 border border-gray-200 rounded-lg text-gray-800 bg-gray-50 text-center"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1">
                    Año (AA)
                  </Text>
                  <TextInput
                    placeholder="28"
                    maxLength={2}
                    keyboardType="numeric"
                    value={cardData.expirationYear}
                    onChangeText={(text) =>
                      setCardData({ ...cardData, expirationYear: text })
                    }
                    className="w-full text-sm p-3 border border-gray-200 rounded-lg text-gray-800 bg-gray-50 text-center"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1">
                    CVV
                  </Text>
                  <TextInput
                    placeholder="123"
                    maxLength={4}
                    keyboardType="numeric"
                    value={cardData.securityCode}
                    onChangeText={(text) =>
                      setCardData({ ...cardData, securityCode: text })
                    }
                    className="w-full text-sm p-3 border border-gray-200 rounded-lg text-gray-800 bg-gray-50 text-center"
                  />
                </View>
              </View>

              <Pressable
                disabled={isProcessing}
                onPress={() => handleProcessPayment('mercadopago')}
                className={`w-full bg-sky-500 h-12 rounded-lg justify-center items-center active:bg-sky-600 shadow-md mt-2 ${isProcessing ? 'opacity-50' : ''}`}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white text-sm font-bold">
                    Confirmar y Pagar ${total.toFixed(2)}
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setShowMpForm(false)}
                className="py-2 items-center"
              >
                <Text className="text-xs text-gray-400 font-semibold">
                  Cancelar / Volver
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-y-3 pt-2">
              <Pressable
                disabled={isProcessing}
                onPress={() => setShowMpForm(true)}
                className={`w-full bg-sky-500 h-12 rounded-lg justify-center items-center active:bg-sky-600 shadow-md ${isProcessing ? 'opacity-50' : ''}`}
              >
                <Text className="text-white text-sm font-bold">
                  Pagar con Mercado Pago
                </Text>
              </Pressable>

              <Pressable
                disabled={isProcessing}
                onPress={() => handleProcessPayment('stripe')}
                className={`w-full bg-indigo-600 h-12 rounded-lg justify-center items-center active:bg-indigo-700 shadow-md ${isProcessing ? 'opacity-50' : ''}`}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white text-sm font-bold">
                    Pagar con Stripe
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
