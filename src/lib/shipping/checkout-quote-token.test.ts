import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CheckoutInventoryItem } from '@/lib/checkout/inventory';
import { createCheckoutQuoteToken, verifyCheckoutQuoteToken } from './checkout-quote-token';
import type { CheckoutShippingOption } from './types';

const user = {
  id: 'buyer-1',
  deliveryAddressId: 'saved-address-1',
  shippingStreet: 'Av. Corrientes',
  shippingNumber: '1234',
  shippingApartment: null,
  shippingCity: 'CABA',
  shippingProvince: 'Buenos Aires',
  shippingPostalCode: 'C1043',
  shippingCountry: 'Argentina',
};

const items: CheckoutInventoryItem[] = [
  {
    id: 123,
    productId: 12,
    articleId: 123,
    variantId: 'variant-1',
    colorName: 'Negro',
    title: 'Zapatilla de prueba',
    quantity: 1,
    size: '40',
  },
];

const quote: CheckoutShippingOption = {
  id: 'zipnova:12:standard:home',
  provider: 'ZIPNOVA',
  carrier: 'Correo de prueba',
  service: 'Entrega a domicilio',
  amount: 2500,
  currency: 'ARS',
  estimatedDeliveryAt: null,
  meta: { carrierId: 12, serviceType: 'home' },
  subtotal: 26716.94,
  taxAmount: 5610.56,
  taxRate: 21,
  taxCalculationMethod: 'tax_exclusive_base',
  taxName: 'IVA',
  taxCountry: 'AR',
  productTotal: 32327.5,
  shippingAmount: 2500,
  totalInStoreCurrency: 34827.5,
  paymentShippingAmount: 1.64,
  paymentTotal: 22.8,
  paymentCurrency: 'USD',
  paymentExchangeRate: 0.000656,
  storeCurrency: 'ARS',
  quoteToken: '',
};

describe('checkout shipping quote tokens', () => {
  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-only-checkout-secret-at-least-32-chars');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('verifies the signed option for the same buyer, address and cart', () => {
    const token = createCheckoutQuoteToken(user, items, quote);
    const verified = verifyCheckoutQuoteToken(token, user, items);

    expect(verified.quoteToken).toBe(token);
    expect(verified.totalInStoreCurrency).toBe(34827.5);
    expect(verified.paymentTotal).toBe(22.8);
  });

  it('rejects a token whose signature was modified', () => {
    const token = createCheckoutQuoteToken(user, items, quote);
    const [payload, signature] = token.split('.');
    const tampered = `${payload!.slice(0, -1)}${payload!.endsWith('A') ? 'B' : 'A'}.${signature}`;

    expect(() => verifyCheckoutQuoteToken(tampered, user, items)).toThrow(
      /cotización de envío no es válida/i,
    );
  });

  it('rejects a quote when the cart, saved delivery address or address data changed', () => {
    const token = createCheckoutQuoteToken(user, items, quote);

    expect(() =>
      verifyCheckoutQuoteToken(
        token,
        user,
        items.map((item) => ({ ...item, quantity: 2 })),
      ),
    ).toThrow(/cotización venció o cambió/i);
    expect(() =>
      verifyCheckoutQuoteToken(token, { ...user, shippingNumber: '5678' }, items),
    ).toThrow(/cotización venció o cambió/i);
    expect(() =>
      verifyCheckoutQuoteToken(token, { ...user, deliveryAddressId: 'saved-address-2' }, items),
    ).toThrow(/cotización venció o cambió/i);
  });
});
