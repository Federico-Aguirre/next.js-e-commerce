import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePayPalCardPayment } from './usePayPalCardPayment';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const savedCard = {
  id: 'saved-paypal-card-1',
  brand: 'Visa',
  lastFourDigits: '4242',
  expirationMonth: 12,
  expirationYear: 2030,
};

describe('usePayPalCardPayment new-card form', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ cards: [savedCard] })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mounts the card fields when the buyer chooses to add a new card after saved cards load', async () => {
    const { result } = renderHook(() =>
      usePayPalCardPayment({
        cartItems: [],
        onSuccess: vi.fn(),
        shippingQuoteToken: 'signed-quote',
      }),
    );

    await waitFor(() => expect(result.current.cardsLoading).toBe(false));
    expect(result.current.saveCard).toBe(true);
    expect(result.current.selectedPaymentMethod).toBe(savedCard.id);
    expect(result.current.cardFieldsMounted).toBe(false);

    act(() => result.current.choosePaymentMethod('new'));

    expect(result.current.selectedPaymentMethod).toBe('new');
    expect(result.current.cardFieldsMounted).toBe(true);
    expect(result.current.ready).toBe(false);
    expect(result.current.saveCard).toBe(true);
  });
});
