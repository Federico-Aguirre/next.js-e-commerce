export function formatOrderNumber(orderNumber: number) {
  return String(orderNumber).padStart(6, '0');
}

export function paymentProviderLabel(provider: string | null | undefined) {
  switch (provider?.toUpperCase()) {
    case 'MERCADOPAGO':
      return 'Mercado Pago';
    case 'PAYPAL':
      return 'PayPal';
    case 'STRIPE':
      return 'Stripe';
    default:
      return provider?.trim() || '—';
  }
}
