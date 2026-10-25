import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mercadoPagoMock, stripeMock, paypalMock } = vi.hoisted(() => ({
  mercadoPagoMock: vi.fn(),
  stripeMock: vi.fn(),
  paypalMock: vi.fn(),
}));

vi.mock('@/lib/payments/platform-config', () => ({
  mercadoPagoPaymentConfig: mercadoPagoMock,
  stripePaymentConfig: stripeMock,
  paypalPaymentConfig: paypalMock,
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, connection: vi.fn().mockResolvedValue(undefined) };
});

import { GET } from './route';

describe('/api/payment-methods/status cache policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mercadoPagoMock.mockResolvedValue({ chargeEnabled: true, accessToken: 'server-only-token' });
    stripeMock.mockResolvedValue({ splitEnabled: true, connectedAccountId: 'acct_test' });
    paypalMock.mockResolvedValue({ splitEnabled: false, sellerMerchantId: null });
  });

  it('does not cache provider availability and exposes booleans only', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(body).toEqual({
      sandbox: true,
      mercadoPago: true,
      stripe: true,
      paypal: false,
    });
    expect(JSON.stringify(body)).not.toContain('server-only-token');
  });
});
