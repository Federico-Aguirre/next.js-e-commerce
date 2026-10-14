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
  orderId?: string;
  status?: string;
  status_detail?: string;
  message?: string;
  error?: string;
  requestId?: string | null;
  mercadoPagoStatus?: number | null;
  mercadoPagoError?: string | null;
  mercadoPagoCauses?: unknown[] | null;
};

export async function processCardPayment({
  formData,
  cartItems,
}: ProcessCardPaymentParams): Promise<PaymentResult> {
  await loadMercadoPago();

  const publicKey =
    process.env.NEXT_PUBLIC_DEVELOPER_MERCADOPAGO_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_STORE_MERCADOPAGO_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error('Falta NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY.');
  }

  const MercadoPago = (window as any).MercadoPago;

  if (!MercadoPago) {
    throw new Error('Mercado Pago no está disponible.');
  }

  const mp = new MercadoPago(publicKey, { locale: 'es-AR' });
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

  const reservationResponse = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: cartItems,
      paymentMethod: 'mercadopago-card',
      checkoutKey: crypto.randomUUID(),
    }),
  });
  const reservation = await reservationResponse.json();

  if (!reservationResponse.ok || !reservation.orderId) {
    throw new Error(reservation.error || reservation.message || 'No se pudo reservar el stock.');
  }

  localStorage.setItem('last_pending_order_id', reservation.orderId);

  const response = await fetch('/api/process-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: reservation.orderId,
      token: tokenResponse.id,
      payment_method_id: 'master',
      description: 'Compra desde carrito',
      email: formData.email,
      docType: formData.docType,
      docNumber: formData.docNumber,
      installments: Number(formData.installments),
      tokenMetadata: {
        firstSixDigits: tokenResponse.first_six_digits ?? null,
        lastFourDigits: tokenResponse.last_four_digits ?? null,
        cardholderName: tokenResponse.cardholder?.name ?? null,
        identificationType: tokenResponse.cardholder?.identification?.type ?? null,
        identificationNumber: tokenResponse.cardholder?.identification?.number ?? null,
        publicKeyMatches: tokenResponse.public_key ? tokenResponse.public_key === publicKey : null,
      },
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    const message = result.message || result.error || 'No se pudo procesar el pago.';
    const details = [
      result.mercadoPagoStatus ? `MP HTTP ${result.mercadoPagoStatus}` : null,
      result.mercadoPagoError ? `código ${result.mercadoPagoError}` : null,
      Array.isArray(result.mercadoPagoCauses) && result.mercadoPagoCauses.length > 0
        ? `causas ${JSON.stringify(result.mercadoPagoCauses)}`
        : null,
    ].filter(Boolean);
    const diagnostic = details.length > 0 ? ` [${details.join(' | ')}]` : '';
    const requestId = result.requestId ? ` (Mercado Pago requestId: ${result.requestId})` : '';
    throw new Error(`${message}${diagnostic}${requestId}`);
  }

  return result;
}
