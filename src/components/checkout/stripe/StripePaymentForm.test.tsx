import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useStripeMock, useElementsMock, confirmCardPaymentMock, getElementMock } = vi.hoisted(
  () => ({
    useStripeMock: vi.fn(),
    useElementsMock: vi.fn(),
    confirmCardPaymentMock: vi.fn(),
    getElementMock: vi.fn(),
  }),
);

vi.mock('@stripe/react-stripe-js', () => ({
  CardCvcElement: () => null,
  CardExpiryElement: () => null,
  CardNumberElement: () => null,
  useStripe: useStripeMock,
  useElements: useElementsMock,
}));

import StripePaymentForm from './StripePaymentForm';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderForm() {
  const onSuccess = vi.fn();
  render(
    <StripePaymentForm
      clientSecret="pi_secret_test"
      orderId="order-1"
      paymentIntentId="pi_test_1"
      amount={12}
      onSuccess={onSuccess}
    />,
  );
  return { onSuccess };
}

describe('StripePaymentForm saved cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    useStripeMock.mockReturnValue({ confirmCardPayment: confirmCardPaymentMock });
    useElementsMock.mockReturnValue({ getElement: getElementMock });
    getElementMock.mockReturnValue({ cardElement: true });
    confirmCardPaymentMock.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
  });

  it('shows the normal card form and optional save checkbox when the user has no saved cards', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ cards: [] }));
    renderForm();
    expect(await screen.findByText('Número de tarjeta')).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Pagar ARS\s*12,00/i })).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: /Guardar esta tarjeta para futuras compras/i }),
    ).toBeChecked();
    expect(screen.queryByText('Consultando tus tarjetas guardadas…')).toBeNull();
  });

  it('shows saved cards first with an option to add a different card', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        cards: [
          {
            id: 'local-card-1',
            brand: 'Visa',
            lastFourDigits: '4242',
            expirationMonth: 12,
            expirationYear: 2030,
          },
        ],
      }),
    );
    renderForm();
    expect(await screen.findByText('Visa')).toBeTruthy();
    expect(screen.getByText('•••• 4242')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Agregar nueva tarjeta/i })).toBeTruthy();
    expect(screen.queryByText('Número de tarjeta')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Agregar nueva tarjeta/i }));
    expect(screen.getByText('Número de tarjeta')).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: /Guardar esta tarjeta para futuras compras/i }),
    ).toBeChecked();
  });

  it('prepares and confirms a saved card using only its server-side owned identifier', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          cards: [
            {
              id: 'local-card-1',
              brand: 'Visa',
              lastFourDigits: '4242',
              expirationMonth: 12,
              expirationYear: 2030,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ready: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true }));
    const { onSuccess } = renderForm();
    const payButton = await screen.findByRole('button', { name: /Pagar.*Visa/i });
    fireEvent.click(payButton);

    await waitFor(() => expect(confirmCardPaymentMock).toHaveBeenCalledWith('pi_secret_test'));
    const prepareCall = fetchMock.mock.calls.find(([url]) => url === '/api/stripe/prepare');
    expect(prepareCall).toBeTruthy();
    expect(JSON.parse(String(prepareCall?.[1]?.body))).toEqual({
      paymentIntentId: 'pi_test_1',
      orderId: 'order-1',
      savedPaymentMethodId: 'local-card-1',
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it('requests future-use setup by default when the buyer keeps the save-card option checked', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ cards: [] }))
      .mockResolvedValueOnce(jsonResponse({ ready: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(
        jsonResponse({
          cards: [
            {
              id: 'local-card-1',
              brand: 'Visa',
              lastFourDigits: '4242',
              expirationMonth: 12,
              expirationYear: 2030,
            },
          ],
        }),
      );
    const { onSuccess } = renderForm();
    expect(
      await screen.findByRole('checkbox', { name: /Guardar esta tarjeta para futuras compras/i }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Pagar/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const prepareCall = fetchMock.mock.calls.find(([url]) => url === '/api/stripe/prepare');
    expect(JSON.parse(String(prepareCall?.[1]?.body))).toEqual({
      paymentIntentId: 'pi_test_1',
      orderId: 'order-1',
      savePaymentMethod: true,
    });
    expect(confirmCardPaymentMock).toHaveBeenCalledWith('pi_secret_test', {
      payment_method: { card: { cardElement: true } },
    });
  });
});
