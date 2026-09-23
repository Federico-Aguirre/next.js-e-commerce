import { loadMercadoPago } from '@mercadopago/sdk-js';

import type { CartItem } from '@/store/useCartStore';

import type { CheckoutFormData } from './checkoutSchema';

type ProcessCardPaymentParams = {
  formData: CheckoutFormData;
  cartItems: CartItem[];
  cartTotal: number;
};

type PaymentResult = {
  id?: string;
  order_id?: string | null;
  status?: string;
  status_detail?: string;
  message?: string;
};

export async function processCardPayment({
  formData,
  cartItems,
  cartTotal,
}: ProcessCardPaymentParams): Promise<PaymentResult> {
  await loadMercadoPago();

  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error('Falta NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY.');
  }

  const MercadoPago = (window as any).MercadoPago;

  if (!MercadoPago) {
    throw new Error('Mercado Pago no está disponible.');
  }

  const mp = new MercadoPago(publicKey, {
    locale: 'es-AR',
  });

  const tokenResponse = await mp.createCardToken({
    cardNumber: formData.cardNumber,
    cardholderName: formData.cardholderName,
    cardExpirationMonth: formData.cardExpirationMonth,
    cardExpirationYear: formData.cardExpirationYear,
    securityCode: formData.securityCode,
    identificationType: formData.docType,
    identificationNumber: formData.docNumber,
  });

  if (!tokenResponse?.id) {
    throw new Error('No se pudo tokenizar la tarjeta.');
  }

  const response = await fetch('/api/process-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: tokenResponse.id,
      transaction_amount: Number(cartTotal.toFixed(2)),
      payment_method_id: 'master',
      description: 'Compra desde carrito',

      email: formData.email,
      docType: formData.docType,
      docNumber: formData.docNumber,
      installments: formData.installments,

      items: cartItems.map((item) => ({
        id: item.id,
        articleId: item.articleId,
        title: item.title,
        price: item.price,
        colorName: item.colorName,
        size: item.size,
        quantity: item.quantity,
        category: item.category,
      })),
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudo procesar el pago.');
  }

  return result;
}
