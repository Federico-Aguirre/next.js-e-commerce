import { describe, expect, it } from 'vitest';
import { selectCheapestDeliveryQuote, selectFasterDeliveryQuote } from './select-cheapest-quote';
import type { CheckoutShippingOption } from './types';

function quote(
  overrides: Partial<CheckoutShippingOption> &
    Pick<CheckoutShippingOption, 'id' | 'provider' | 'shippingAmount'>,
): CheckoutShippingOption {
  return {
    carrier: 'Carrier',
    service: 'Entrega a domicilio',
    amount: overrides.shippingAmount,
    currency: 'ARS',
    estimatedDeliveryAt: null,
    meta: {},
    subtotal: 1000,
    taxAmount: 210,
    taxRate: 21,
    taxCalculationMethod: 'tax_exclusive_base',
    taxName: 'IVA',
    taxCountry: 'AR',
    productTotal: 1210,
    totalInStoreCurrency: 1210 + overrides.shippingAmount,
    paymentShippingAmount: overrides.shippingAmount,
    paymentTotal: 2,
    paymentCurrency: 'USD',
    paymentExchangeRate: 0.001,
    storeCurrency: 'ARS',
    quoteToken: '',
    ...overrides,
  };
}

describe('selectCheapestDeliveryQuote', () => {
  it('chooses the least expensive delivery fee in store currency rather than comparing provider currencies', () => {
    const expensive = quote({
      id: 'zipnova',
      provider: 'ZIPNOVA',
      amount: 1200,
      currency: 'ARS',
      shippingAmount: 1200,
    });
    const cheapest = quote({
      id: 'shippo',
      provider: 'SHIPPO',
      amount: 2,
      currency: 'USD',
      shippingAmount: 900,
    });

    expect(selectCheapestDeliveryQuote([expensive, cheapest])?.id).toBe('shippo');
  });

  it('never treats free store pickup as the cheapest delivery-to-address service', () => {
    const pickup = quote({
      id: 'pickup',
      provider: 'LOCAL',
      carrier: 'Retiro en tienda',
      service: 'Retiro en tienda',
      shippingAmount: 0,
      meta: { kind: 'pickup' },
    });
    const homeDelivery = quote({
      id: 'local-delivery',
      provider: 'LOCAL',
      carrier: 'Envío local',
      service: 'Tarifa plana local',
      shippingAmount: 400,
      meta: { kind: 'flat_rate' },
    });

    expect(selectCheapestDeliveryQuote([pickup, homeDelivery])?.id).toBe('local-delivery');
    expect(selectCheapestDeliveryQuote([pickup])).toBeNull();
  });

  it('offers only an alternate whose carrier ETA is earlier than the cheapest quote', () => {
    const standard = quote({
      id: 'standard',
      provider: 'ZIPNOVA',
      service: 'Entrega estándar',
      shippingAmount: 1000,
      estimatedDeliveryAt: '2026-10-30T12:00:00-03:00',
    });
    const faster = quote({
      id: 'fast',
      provider: 'ZIPNOVA',
      service: 'Entrega express',
      shippingAmount: 1800,
      estimatedDeliveryAt: '2026-10-27T12:00:00-03:00',
    });
    const notFaster = quote({
      id: 'same-day-estimate',
      provider: 'ZIPNOVA',
      service: 'Otro servicio',
      shippingAmount: 1500,
      estimatedDeliveryAt: '2026-10-30T12:00:00-03:00',
    });

    expect(selectFasterDeliveryQuote([standard, faster, notFaster], standard)?.id).toBe('fast');
  });

  it('requires an expedited service name and a valid ETA if the default ETA is missing', () => {
    const standard = quote({
      id: 'standard',
      provider: 'ZIPNOVA',
      shippingAmount: 1000,
      estimatedDeliveryAt: null,
    });
    const unlabelled = quote({
      id: 'unlabelled',
      provider: 'ZIPNOVA',
      service: 'Entrega a domicilio',
      shippingAmount: 1200,
      estimatedDeliveryAt: '2026-10-27T12:00:00-03:00',
    });
    const express = quote({
      id: 'express',
      provider: 'ZIPNOVA',
      service: 'Entrega Express',
      shippingAmount: 1800,
      estimatedDeliveryAt: '2026-10-27T12:00:00-03:00',
    });

    expect(selectFasterDeliveryQuote([standard, unlabelled, express], standard)?.id).toBe(
      'express',
    );
  });

  it('returns null if there are no quotes', () => {
    expect(selectCheapestDeliveryQuote([])).toBeNull();
  });
});
