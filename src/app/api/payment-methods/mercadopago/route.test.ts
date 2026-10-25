import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthenticatedUserMock, paymentConfigMock, prismaMock } = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  paymentConfigMock: vi.fn(),
  prismaMock: {
    paymentCustomer: { findUnique: vi.fn(), create: vi.fn() },
    savedPaymentMethod: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/request-user', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));
vi.mock('@/lib/payments/platform-config', () => ({
  mercadoPagoPaymentConfig: paymentConfigMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { GET, POST } from './route';

const user = {
  id: 'saved-card-user-1',
  email: 'buyer@example.test',
  firstName: 'Test',
  lastName: 'Buyer',
};

function providerResponse(body: unknown, status = 201) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'x-request-id': 'mp-test-request' },
  });
}

describe('/api/payment-methods/mercadopago', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    getAuthenticatedUserMock.mockResolvedValue(user);
    paymentConfigMock.mockResolvedValue({
      accessToken: 'sandbox-access-token',
      chargeEnabled: true,
      sandbox: true,
      splitEnabled: false,
      externalAccountId: undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requires an authenticated user before listing cards', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce(null);

    const response = await GET(new Request('https://shop.example/api/payment-methods/mercadopago'));

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(prismaMock.paymentCustomer.findUnique).not.toHaveBeenCalled();
  });

  it('returns no stored cards for an authenticated user without a customer record', async () => {
    prismaMock.paymentCustomer.findUnique.mockResolvedValue(null);

    const response = await GET(new Request('https://shop.example/api/payment-methods/mercadopago'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cards: [] });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });

  it('creates a sandbox customer and stores only masked card metadata and provider identifiers', async () => {
    prismaMock.paymentCustomer.findUnique.mockResolvedValue(null);
    prismaMock.paymentCustomer.create.mockResolvedValue({
      id: 'local-customer-1',
      externalCustomerId: 'mp-customer-1',
    });
    prismaMock.savedPaymentMethod.upsert.mockResolvedValue({
      id: 'local-card-1',
      externalCardId: 'mp-card-1',
      paymentMethodId: 'visa',
      paymentType: 'credit_card',
      paymentMethodName: 'Visa',
      lastFourDigits: '4242',
      expirationMonth: 12,
      expirationYear: 2030,
    });

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        providerResponse({ id: 'mp-customer-1', email: 'test_payer_123@testuser.com' }),
      )
      .mockResolvedValueOnce(
        providerResponse({
          id: 'mp-card-1',
          last_four_digits: '4242',
          expiration_month: 12,
          expiration_year: 2030,
          payment_method: { id: 'visa', name: 'Visa', payment_type_id: 'credit_card' },
        }),
      );

    const response = await POST(
      new Request('https://shop.example/api/payment-methods/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'secure-one-time-card-token' }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.card).toMatchObject({
      id: 'local-card-1',
      cardId: 'mp-card-1',
      paymentMethodId: 'visa',
      brand: 'Visa',
      lastFourDigits: '4242',
      expirationMonth: 12,
      expirationYear: 2030,
    });
    expect(JSON.stringify(body)).not.toContain('secure-one-time-card-token');
    expect(JSON.stringify(body)).not.toContain('4242424242424242');
    expect(prismaMock.paymentCustomer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          provider: 'MERCADOPAGO',
          externalCustomerId: 'mp-customer-1',
          accountScope: expect.stringMatching(/^sandbox-token-/),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(fetchMock.mock.calls[1])).toContain('secure-one-time-card-token');
  });

  it('does not create a provider customer for an invalid token request', async () => {
    const response = await POST(
      new Request('https://shop.example/api/payment-methods/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(prismaMock.paymentCustomer.create).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not allow saving cards outside sandbox mode', async () => {
    paymentConfigMock.mockResolvedValueOnce({
      accessToken: 'live-token',
      chargeEnabled: true,
      sandbox: false,
      splitEnabled: false,
    });

    const response = await POST(
      new Request('https://shop.example/api/payment-methods/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'secure-one-time-card-token' }),
      }),
    );

    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
});
