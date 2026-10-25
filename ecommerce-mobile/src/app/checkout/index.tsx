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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCartStore, CartItem } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useUserStore } from '@/store/useUserStore';
import { authenticatedFetch } from '@/services/authenticatedFetch';
import {
  checkoutItemsPayload,
  fetchCheckoutShippingQuotes,
  formatCheckoutDeliveryEstimate,
  formatCheckoutMoney,
} from '@/services/checkoutShipping';
import { useCheckoutShippingQuotes } from '@/hooks/useCheckoutShippingQuotes';

const configuredApiBaseUrl =
  process.env.EXPO_PUBLIC_BASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_API_URL?.trim();
const API_BASE_URL =
  configuredApiBaseUrl?.replace(/\/api\/?$/i, '').replace(/\/+$/, '') ||
  (__DEV__ ? 'http://192.168.3.2:3001' : '');

export default function CheckoutScreen() {
  const { cart, addToCart, removeFromCart } = useCartStore();
  const searchParams = useLocalSearchParams();
  const router = useRouter();

  // 🔍 OBTENCIÓN DE SESIÓN/USUARIO DESDE ZUSTAND
  const authSession = useAuthStore((state) => state.session);
  const authUser = useAuthStore((state) => state.user);
  const storeUser = useUserStore((state) => state.user);
  const currentUser = authUser || storeUser || authSession?.user;
  const shippingQuoteState = useCheckoutShippingQuotes(
    API_BASE_URL,
    cart,
    Boolean(currentUser),
  );
  const selectedShippingQuote = shippingQuoteState.quote;

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // 🛡️ Previene ejecuciones fantasmas o clics dobles rápidos
  const isNavigating = useRef<boolean>(false);

  const subtotal = selectedShippingQuote?.subtotal ?? 0;
  const taxAmount = selectedShippingQuote?.taxAmount ?? 0;
  const productTotal = selectedShippingQuote?.productTotal ?? 0;
  const shippingAmount = selectedShippingQuote?.shippingAmount ?? 0;
  const total = selectedShippingQuote?.totalInStoreCurrency ?? 0;

  const handleProcessPayment = async (
    paymentMethod: 'mercadopago' | 'stripe',
  ) => {
    if (isNavigating.current) return;

    if (!API_BASE_URL || (!__DEV__ && !API_BASE_URL.startsWith('https://'))) {
      setCheckoutError(
        'La aplicación no tiene configurada una URL HTTPS válida para el servidor.',
      );
      return;
    }

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
      const itemsPayload = checkoutItemsPayload(cart);
      const paymentCurrency = paymentMethod === 'mercadopago' ? 'ARS' : 'USD';
      let paymentQuote = selectedShippingQuote;
      if (!paymentQuote || paymentQuote.paymentCurrency !== paymentCurrency) {
        const selectedChoice = paymentQuote?.meta.checkoutChoice;
        const refreshedQuotes = await fetchCheckoutShippingQuotes(
          API_BASE_URL,
          cart,
          paymentCurrency,
        );
        paymentQuote =
          refreshedQuotes.find(
            (quote) => quote.meta.checkoutChoice === selectedChoice,
          ) ??
          refreshedQuotes[0] ??
          null;
      }
      if (!paymentQuote)
        throw new Error('Primero cotizá y seleccioná una opción de envío.');

      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Confirmar total de la compra',
          [
            `Subtotal sin impuestos: ${formatCheckoutMoney(paymentQuote!.subtotal, paymentQuote!.storeCurrency)}`,
            `${paymentQuote!.taxName}${paymentQuote!.taxRate ? ` (${paymentQuote!.taxRate}%)` : ''}: ${formatCheckoutMoney(paymentQuote!.taxAmount, paymentQuote!.storeCurrency)}`,
            `Envío (${paymentQuote!.carrier}): ${formatCheckoutMoney(paymentQuote!.shippingAmount, paymentQuote!.storeCurrency)}`,
            `Total final: ${formatCheckoutMoney(paymentQuote!.totalInStoreCurrency, paymentQuote!.storeCurrency)}`,
            `Importe enviado al medio de pago: ${formatCheckoutMoney(paymentQuote!.paymentTotal, paymentQuote!.paymentCurrency)}`,
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

      // Mercado Pago: redirigir al checkout alojado por el proveedor.
      // La app no recoge ni tokeniza directamente los datos de la tarjeta.
      if (paymentMethod === 'mercadopago') {
        const savedOrderId = await AsyncStorage.getItem(
          'last_pending_order_id',
        );
        if (savedOrderId) {
          await authenticatedFetch(`${API_BASE_URL}/api/checkout`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: savedOrderId }),
          }).catch(() => {});
          await AsyncStorage.removeItem('last_pending_order_id');
        }

        const response = await authenticatedFetch(
          `${API_BASE_URL}/api/checkout`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              items: itemsPayload,
              paymentMethod: 'mercadopago',
              shippingQuoteToken: paymentQuote.quoteToken,
            }),
          },
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || 'No se pudo iniciar el checkout de Mercado Pago.',
          );
        }
        if (data.orderId) {
          await AsyncStorage.setItem('last_pending_order_id', data.orderId);
        }
        if (typeof data.url !== 'string') {
          throw new Error('Mercado Pago no devolvió una URL de pago.');
        }

        const paymentUrl = new URL(data.url);
        const isMercadoPagoHost = /(^|\.)mercadopago\.com(\.ar)?$/i.test(
          paymentUrl.hostname,
        );
        if (paymentUrl.protocol !== 'https:' || !isMercadoPagoHost) {
          throw new Error(
            'Mercado Pago devolvió una URL de pago no segura o inesperada.',
          );
        }

        await Linking.openURL(paymentUrl.toString());
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
          await authenticatedFetch(`${API_BASE_URL}/api/checkout`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: savedOrderId }),
          }).catch(() => {});
          await AsyncStorage.removeItem('last_pending_order_id');
        }

        const response = await authenticatedFetch(
          `${API_BASE_URL}/api/checkout`,
          {
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
              shippingQuoteToken: paymentQuote.quoteToken,
            }),
          },
        );

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
          {shippingQuoteState.loading && (
            <View className="flex-row items-center gap-x-2 py-2">
              <ActivityIndicator size="small" />
              <Text className="text-sm text-gray-500">Cotizando el envío…</Text>
            </View>
          )}
          {shippingQuoteState.error && (
            <View className="gap-y-2 rounded-lg bg-amber-50 p-3">
              <Text className="text-sm text-amber-900">
                {shippingQuoteState.error}
              </Text>
              <Pressable onPress={shippingQuoteState.refreshQuotes}>
                <Text className="font-semibold text-amber-900 underline">
                  Volver a cotizar
                </Text>
              </Pressable>
            </View>
          )}
          {selectedShippingQuote &&
            !shippingQuoteState.loading &&
            !shippingQuoteState.error &&
            shippingQuoteState.availableQuotes.length > 1 && (
              <View className="mb-3 gap-y-2">
                <Text className="font-semibold text-gray-900">
                  Elegí cómo querés recibir tu pedido
                </Text>
                {shippingQuoteState.availableQuotes.map((quote) => {
                  const selected = quote.id === selectedShippingQuote.id;
                  const isFaster = quote.meta.checkoutChoice === 'faster';
                  return (
                    <Pressable
                      key={quote.id}
                      onPress={() => shippingQuoteState.selectQuote(quote.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      className={`flex-row items-start gap-x-3 rounded-lg border p-3 ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <View
                        className={`mt-1 h-4 w-4 rounded-full border-2 items-center justify-center ${
                          selected ? 'border-indigo-600' : 'border-gray-400'
                        }`}
                      >
                        {selected && (
                          <View className="h-2 w-2 rounded-full bg-indigo-600" />
                        )}
                      </View>
                      <View className="flex-1 gap-y-1">
                        <Text className="font-semibold text-gray-900">
                          {isFaster
                            ? 'Entrega más rápida'
                            : 'Envío más económico'}
                        </Text>
                        <Text className="text-sm text-gray-700">
                          {quote.carrier} · {quote.service}
                        </Text>
                        <Text className="text-xs text-gray-500">
                          {formatCheckoutDeliveryEstimate(
                            quote.estimatedDeliveryAt,
                          )}
                        </Text>
                      </View>
                      <Text className="text-right text-sm font-semibold text-gray-900">
                        {quote.shippingAmount === 0
                          ? 'Sin costo'
                          : formatCheckoutMoney(
                              quote.shippingAmount,
                              quote.storeCurrency,
                            )}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          {selectedShippingQuote &&
            !shippingQuoteState.loading &&
            !shippingQuoteState.error &&
            shippingQuoteState.availableQuotes.length === 1 && (
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
                <Text className="mt-2 text-xs text-gray-600">
                  {formatCheckoutDeliveryEstimate(
                    selectedShippingQuote.estimatedDeliveryAt,
                  )}
                </Text>
              </View>
            )}
          {!shippingQuoteState.loading &&
            !shippingQuoteState.error &&
            selectedShippingQuote && (
              <View className="gap-y-2 text-sm">
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-600 text-sm">
                    Subtotal sin impuestos
                  </Text>
                  <Text className="font-semibold text-gray-900 text-sm">
                    {formatCheckoutMoney(
                      subtotal,
                      selectedShippingQuote.storeCurrency,
                    )}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-600 text-sm">
                    {selectedShippingQuote.taxName}
                    {selectedShippingQuote.taxRate
                      ? ` (${selectedShippingQuote.taxRate}%)`
                      : ''}
                  </Text>
                  <Text className="font-semibold text-gray-900 text-sm">
                    {formatCheckoutMoney(
                      taxAmount,
                      selectedShippingQuote.storeCurrency,
                    )}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-600 text-sm">
                    Productos con impuestos
                  </Text>
                  <Text className="font-semibold text-gray-900 text-sm">
                    {formatCheckoutMoney(
                      productTotal,
                      selectedShippingQuote.storeCurrency,
                    )}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-600 text-sm">Envío</Text>
                  <Text className="font-semibold text-gray-900 text-sm">
                    {formatCheckoutMoney(
                      shippingAmount,
                      selectedShippingQuote.storeCurrency,
                    )}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center border-t border-gray-100 pt-3 mt-1">
                  <Text className="font-black text-gray-900 text-base">
                    Total final
                  </Text>
                  <Text className="font-black text-gray-900 text-xl">
                    {formatCheckoutMoney(
                      total,
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

          <View className="gap-y-3 pt-2">
            <Pressable
              disabled={
                isProcessing ||
                shippingQuoteState.loading ||
                !selectedShippingQuote ||
                Boolean(shippingQuoteState.error)
              }
              onPress={() => handleProcessPayment('mercadopago')}
              className={`w-full bg-sky-500 h-12 rounded-lg justify-center items-center active:bg-sky-600 shadow-md ${isProcessing ? 'opacity-50' : ''}`}
            >
              {isProcessing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-sm font-bold">
                  Pagar de forma segura con Mercado Pago
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
