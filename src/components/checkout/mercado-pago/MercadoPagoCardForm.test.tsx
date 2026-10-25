import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/store/useCartStore';

const {
  clearCartMock,
  loadMercadoPagoMock,
  replaceMock,
  useCurrencyMock,
  cardFormMock,
  createFieldMock,
  createCardTokenMock,
} = vi.hoisted(() => ({
  clearCartMock: vi.fn(),
  loadMercadoPagoMock: vi.fn(),
  replaceMock: vi.fn(),
  useCurrencyMock: vi.fn(),
  cardFormMock: vi.fn(),
  createFieldMock: vi.fn(),
  createCardTokenMock: vi.fn(),
}));

vi.mock('@mercadopago/sdk-js', () => ({ loadMercadoPago: loadMercadoPagoMock }));
vi.mock('next/navigation', () => {
  const stableRouter = { replace: replaceMock };
  return { useRouter: () => stableRouter };
});
vi.mock('@/providers/CurrencyProvider', () => ({
  useCurrency: () => useCurrencyMock(),
}));
vi.mock('@/store/useCartStore', () => ({
  useCartStore: (selector: (state: { clearCart: () => void }) => unknown) =>
    selector({ clearCart: clearCartMock }),
}));

import MercadoPagoCardForm from './MercadoPagoCardForm';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const cardData = {
  id: 'saved-card-local-1',
  cardId: 'mp-card-1',
  paymentMethodId: 'visa',
  paymentType: 'credit_card',
  brand: 'Visa',
  lastFourDigits: '4242',
  expirationMonth: 12,
  expirationYear: 2030,
};

const cartItems = [
  {
    id: 1,
    title: 'Producto de prueba',
    price: 100,
    quantity: 1,
    image: '',
    size: 'M',
  },
] as unknown as CartItem[];

let cardFormOptions: Record<string, unknown> | null = null;
let mpInstance: {
  cardForm: typeof cardFormMock;
  fields: {
    create: typeof createFieldMock;
    createCardToken: typeof createCardTokenMock;
  };
};

describe('MercadoPagoCardForm saved cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    useCurrencyMock.mockReturnValue({
      convertAmount: (amount: number) => amount,
      ratesReady: true,
      rates: { ARS: 1 },
    });
    cardFormOptions = null;
    cardFormMock.mockImplementation((options: Record<string, unknown>) => {
      cardFormOptions = options;
      const callbacks = options.callbacks as { onFormMounted: (error: unknown) => void };
      callbacks.onFormMounted(null);
      return {
        getCardFormData: vi.fn(() => ({
          token: 'full-card-token',
          paymentMethodId: 'visa',
          issuerId: 'issuer-1',
          cardholderEmail: 'buyer@example.test',
          installments: '1',
          identificationType: 'DNI',
          identificationNumber: '12345678',
        })),
        unmount: vi.fn(),
      };
    });
    createFieldMock.mockReturnValue({ mount: vi.fn(), unmount: vi.fn() });
    createCardTokenMock.mockResolvedValue({ id: 'cvv-only-token' });
    mpInstance = {
      cardForm: cardFormMock,
      fields: {
        create: createFieldMock,
        createCardToken: createCardTokenMock,
      },
    };
    function MercadoPagoMock() {
      return mpInstance;
    }
    Object.defineProperty(window, 'MercadoPago', {
      configurable: true,
      value: MercadoPagoMock,
    });
    loadMercadoPagoMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'MercadoPago');
  });

  it('shows the new-card form directly when there are no saved cards', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ cards: [] }))
      .mockResolvedValueOnce(jsonResponse({ publicKey: 'TEST-PUBLIC-KEY', mode: 'standalone' }));

    render(
      <MercadoPagoCardForm
        cartItems={cartItems}
        cartTotal={100}
        shippingQuoteToken="signed-quote"
        paymentTotal={121}
      />,
    );

    expect(await screen.findByText('Número de tarjeta')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Guardar esta tarjeta para futuras compras/ }),
    ).toBeChecked();
    await waitFor(() => expect(cardFormMock).toHaveBeenCalledTimes(1));
  });

  it('shows saved cards first and lets the customer move to Add new card', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ cards: [cardData] }))
      .mockResolvedValueOnce(jsonResponse({ publicKey: 'TEST-PUBLIC-KEY', mode: 'standalone' }));

    render(
      <MercadoPagoCardForm
        cartItems={cartItems}
        cartTotal={100}
        shippingQuoteToken="signed-quote"
        paymentTotal={121}
      />,
    );

    expect(await screen.findByText('Pagar con Visa terminada en 4242')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agregar nueva tarjeta/ })).toBeInTheDocument();
    expect(createFieldMock).toHaveBeenCalledWith('securityCode', { placeholder: 'CVV' });
    expect(cardFormMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Agregar nueva tarjeta/ }));

    expect(await screen.findByText('Número de tarjeta')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Guardar esta tarjeta para futuras compras/ }),
    ).toBeChecked();
    await waitFor(() => expect(cardFormMock).toHaveBeenCalledTimes(1));
  });

  it('saves the default-selected card and asks for the CVV again before the first payment', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ cards: [] }))
      .mockResolvedValueOnce(jsonResponse({ publicKey: 'TEST-PUBLIC-KEY', mode: 'standalone' }))
      .mockResolvedValueOnce(jsonResponse({ card: cardData }, 201));

    render(
      <MercadoPagoCardForm
        cartItems={cartItems}
        cartTotal={100}
        shippingQuoteToken="signed-quote"
        paymentTotal={121}
      />,
    );

    const checkbox = await screen.findByRole('checkbox', {
      name: /Guardar esta tarjeta para futuras compras/,
    });
    expect(checkbox).toBeChecked();

    await waitFor(() => expect(cardFormOptions).not.toBeNull());

    await act(async () => {
      const options = cardFormOptions as {
        callbacks: { onSubmit: (event: Event) => Promise<void> };
      };
      await options.callbacks.onSubmit({ preventDefault: vi.fn() } as unknown as Event);
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/payment-methods/mercadopago',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'full-card-token' }),
      }),
    );
    expect(await screen.findByText(/La tarjeta quedó guardada/)).toBeInTheDocument();
    expect(screen.getByText('Pagar con Visa terminada en 4242')).toBeInTheDocument();
    expect(createFieldMock).toHaveBeenCalledWith('securityCode', { placeholder: 'CVV' });
  });
});
