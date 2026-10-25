import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CheckoutShippingOption } from '@/lib/shipping/types';
import CheckoutShippingSummary from './CheckoutShippingSummary';

const cheapestQuote: CheckoutShippingOption = {
  id: 'zipnova:12:standard:home',
  provider: 'ZIPNOVA',
  carrier: 'Correo de prueba',
  service: 'Entrega a domicilio',
  amount: 2500,
  currency: 'ARS',
  estimatedDeliveryAt: null,
  meta: {},
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
  quoteToken: 'signed-quote',
};

describe('CheckoutShippingSummary', () => {
  it('shows only the automatically chosen cheapest carrier and the itemized final total', () => {
    render(
      <CheckoutShippingSummary
        selectedQuote={cheapestQuote}
        availableQuotes={[cheapestQuote]}
        onSelectQuote={vi.fn()}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText(/Envío elegido automáticamente · tarifa más económica/i)).toBeTruthy();
    expect(screen.getByText('Correo de prueba · Entrega a domicilio')).toBeTruthy();
    expect(screen.getByText('IVA (21%)')).toBeTruthy();
    expect(screen.queryByText('Productos con impuestos')).toBeNull();
    expect(screen.getByText('Envío')).toBeTruthy();
    expect(screen.getByText('Total final a pagar')).toBeTruthy();
    expect(screen.getByText(/ARS\s*34\.827,50/)).toBeTruthy();
    expect(screen.getByText(/USD\s*22\.80/)).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('lets the customer refresh the quote without exposing a carrier selector', () => {
    const onRetry = vi.fn();
    render(
      <CheckoutShippingSummary
        selectedQuote={cheapestQuote}
        availableQuotes={[cheapestQuote]}
        onSelectQuote={vi.fn()}
        loading={false}
        error={null}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Actualizar cotización de envío/i }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('shows a faster option with the carrier ETA and changes the selected quote', () => {
    const onSelectQuote = vi.fn();
    const fasterQuote: CheckoutShippingOption = {
      ...cheapestQuote,
      id: 'zipnova:fast',
      service: 'Entrega Express',
      amount: 4500,
      estimatedDeliveryAt: '2026-10-27T12:00:00-03:00',
      meta: { checkoutChoice: 'faster' },
      shippingAmount: 4500,
      totalInStoreCurrency: 36827.5,
      paymentShippingAmount: 2.95,
      paymentTotal: 24.11,
      quoteToken: 'signed-fast-quote',
    };

    render(
      <CheckoutShippingSummary
        selectedQuote={cheapestQuote}
        availableQuotes={[cheapestQuote, fasterQuote]}
        onSelectQuote={onSelectQuote}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    const fasterOption = screen.getByRole('radio', { name: /Entrega más rápida/i });
    expect(screen.getByText(/Envío más económico/i)).toBeTruthy();
    expect(screen.getByText(/Entrega aproximada:/i)).toBeTruthy();
    fireEvent.click(fasterOption);
    expect(onSelectQuote).toHaveBeenCalledWith('zipnova:fast');
  });
});
