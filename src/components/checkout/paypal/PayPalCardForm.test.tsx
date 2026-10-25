import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  hookState,
  usePayPalCardPaymentMock,
  convertAmountMock,
  calculateTaxBreakdownMock,
  submitPaymentMock,
  choosePaymentMethodMock,
  changeSaveCardMock,
  removeSavedCardMock,
} = vi.hoisted(() => ({
  hookState: {} as Record<string, unknown>,
  usePayPalCardPaymentMock: vi.fn(),
  convertAmountMock: vi.fn((amount: number) => amount / 100),
  calculateTaxBreakdownMock: vi.fn((amount: number) => ({ total: amount })),
  submitPaymentMock: vi.fn(),
  choosePaymentMethodMock: vi.fn(),
  changeSaveCardMock: vi.fn(),
  removeSavedCardMock: vi.fn(),
}));

vi.mock('next/script', () => ({ default: () => null }));
vi.mock('@/providers/CurrencyProvider', () => ({
  useCurrency: () => ({
    convertAmount: convertAmountMock,
    ratesReady: true,
    taxProfile: { rate: 0, calculationMethod: 'tax_exclusive_base' },
  }),
}));
vi.mock('@/lib/tax/tax-calculation', () => ({ calculateTaxBreakdown: calculateTaxBreakdownMock }));
vi.mock('./PayPalTestData', () => ({ default: () => null }));
vi.mock('./PayPalCardFields', () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="paypal-card-fields" className={className || ''}>
      Secure PayPal card fields
    </div>
  ),
}));
vi.mock('./PayPalPaymentButton', () => ({
  default: ({
    ready,
    loading,
    formLoading,
    onClick,
  }: {
    ready: boolean;
    loading: boolean;
    formLoading: boolean;
    onClick: () => void;
  }) => (
    <button type="button" disabled={!ready || loading || formLoading} onClick={onClick}>
      {loading ? 'Procesando...' : formLoading ? 'Cargando formulario...' : 'Pagar'}
    </button>
  ),
}));
vi.mock('./usePayPalCardPayment', () => ({
  usePayPalCardPayment: usePayPalCardPaymentMock,
}));

import PayPalCardForm from './PayPalCardForm';

const cartItems = [
  {
    id: 1,
    articleId: 1,
    title: 'Producto de prueba',
    price: 1000,
    quantity: 1,
    size: 'M',
    colorName: 'Negro',
    image: '/test.jpg',
  },
];
const savedCard = {
  id: 'local-card-1',
  brand: 'Visa',
  lastFourDigits: '4242',
  expirationMonth: 12,
  expirationYear: 2030,
};

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    scriptUrl: 'https://www.sandbox.paypal.com/web-sdk/v6/core',
    loadSDK: vi.fn(),
    handleSDKError: vi.fn(),
    session: {},
    ready: true,
    setReady: vi.fn(),
    loading: false,
    errorMessage: null,
    setErrorMessage: vi.fn(),
    cardFieldsError: null,
    submitPayment: submitPaymentMock,
    paypalOrderId: null,
    savedCards: [],
    cardsLoading: false,
    cardFieldsMounted: true,
    selectedPaymentMethod: 'new',
    choosePaymentMethod: choosePaymentMethodMock,
    saveCard: true,
    changeSaveCard: changeSaveCardMock,
    removeSavedCard: removeSavedCardMock,
    ...overrides,
  };
}

describe('PayPalCardForm saved cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(hookState, baseHookState());
    usePayPalCardPaymentMock.mockImplementation(() => hookState);
  });

  it('shows the existing card fields directly when there are no saved cards', () => {
    render(
      <PayPalCardForm
        cartItems={cartItems}
        onSuccess={vi.fn()}
        shippingQuoteToken="signed-quote"
        paymentTotal={21.16}
      />,
    );
    expect(screen.getByTestId('paypal-card-fields')).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: /Guardar esta tarjeta para futuras compras/i }),
    ).toBeChecked();
    expect(screen.queryByRole('group', { name: /Elegir tarjeta o agregar una nueva/i })).toBeNull();
  });

  it('shows saved cards first and enables pay without requiring the one-time card-fields session', () => {
    Object.assign(
      hookState,
      baseHookState({
        session: null,
        ready: false,
        savedCards: [savedCard],
        selectedPaymentMethod: savedCard.id,
        cardFieldsMounted: false,
      }),
    );
    render(
      <PayPalCardForm
        cartItems={cartItems}
        onSuccess={vi.fn()}
        shippingQuoteToken="signed-quote"
        paymentTotal={21.16}
      />,
    );

    expect(screen.getByText('Visa')).toBeTruthy();
    expect(screen.getByText('•••• 4242')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Agregar nueva tarjeta/i })).toBeTruthy();
    expect(screen.queryByTestId('paypal-card-fields')).toBeNull();
    expect(screen.getByRole('button', { name: 'Pagar' }).hasAttribute('disabled')).toBe(false);
  });

  it('routes add-new and remove actions to the hook', () => {
    Object.assign(
      hookState,
      baseHookState({
        savedCards: [savedCard],
        selectedPaymentMethod: savedCard.id,
        cardFieldsMounted: false,
      }),
    );
    const { rerender } = render(
      <PayPalCardForm
        cartItems={cartItems}
        onSuccess={vi.fn()}
        shippingQuoteToken="signed-quote"
        paymentTotal={21.16}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Agregar nueva tarjeta/i }));
    expect(choosePaymentMethodMock).toHaveBeenCalledWith('new');

    Object.assign(hookState, {
      selectedPaymentMethod: 'new',
      cardFieldsMounted: true,
      ready: false,
    });
    rerender(
      <PayPalCardForm
        cartItems={cartItems}
        onSuccess={vi.fn()}
        shippingQuoteToken="signed-quote"
        paymentTotal={21.16}
      />,
    );
    expect(screen.getByTestId('paypal-card-fields')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cargando formulario...' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Cargando formulario...' }).hasAttribute('disabled'),
    ).toBe(true);

    Object.assign(hookState, { ready: true });
    rerender(
      <PayPalCardForm
        cartItems={cartItems}
        onSuccess={vi.fn()}
        shippingQuoteToken="signed-quote"
        paymentTotal={21.16}
      />,
    );
    expect(screen.getByRole('button', { name: 'Pagar' }).hasAttribute('disabled')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Eliminar tarjeta/i }));
    expect(removeSavedCardMock).toHaveBeenCalledWith(savedCard.id);
  });

  it('allows the buyer to opt out by unchecking the default-selected save-card option', () => {
    render(
      <PayPalCardForm
        cartItems={cartItems}
        onSuccess={vi.fn()}
        shippingQuoteToken="signed-quote"
        paymentTotal={21.16}
      />,
    );
    const checkbox = screen.getByRole('checkbox', {
      name: /Guardar esta tarjeta para futuras compras/i,
    });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(changeSaveCardMock).toHaveBeenCalledWith(false);
  });

  it('calls the checkout handler when the available PayPal payment button is pressed', () => {
    render(
      <PayPalCardForm
        cartItems={cartItems}
        onSuccess={vi.fn()}
        shippingQuoteToken="signed-quote"
        paymentTotal={21.16}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }));
    expect(submitPaymentMock).toHaveBeenCalledOnce();
  });
});
