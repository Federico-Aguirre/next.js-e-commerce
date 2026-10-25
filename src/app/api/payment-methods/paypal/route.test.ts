import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAuthenticatedUserMock,
  checkRateLimitMock,
  hashRateLimitIdentityMock,
  paypalConfigMock,
  prismaMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  hashRateLimitIdentityMock: vi.fn(),
  paypalConfigMock: vi.fn(),
  prismaMock: {
    paymentCustomer: { findUnique: vi.fn(), upsert: vi.fn() },
    savedPaymentMethod: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/request-user', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  hashRateLimitIdentity: hashRateLimitIdentityMock,
}));
vi.mock('@/lib/payments/platform-config', () => ({
  paypalPaymentConfig: paypalConfigMock,
  paypalAuthAssertion: vi.fn(() => 'sandbox-auth-assertion'),
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { DELETE, GET } from './route';

const user = { id: 'paypal-user-1', email: 'buyer@example.test' };
const customer = {
  id: 'local-paypal-customer-1',
  userId: user.id,
  provider: 'PAYPAL',
  accountScope: 'sandbox-seller-scope',
  externalCustomerId: 'paypal-customer-1',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deleteRequest(savedPaymentMethodId: string) {
  return new Request('https://shop.example/api/payment-methods/paypal', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ savedPaymentMethodId }),
  });
}

describe('/api/payment-methods/paypal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    getAuthenticatedUserMock.mockResolvedValue(user);
    checkRateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    hashRateLimitIdentityMock.mockReturnValue('hashed-user');
    paypalConfigMock.mockResolvedValue({
      clientId: 'sandbox-client-id',
      clientSecret: 'sandbox-client-secret',
      sellerMerchantId: 'seller-sandbox-id',
      partnerAttributionId: 'partner-sandbox-code',
      splitEnabled: true,
      sandbox: true,
    });
    prismaMock.paymentCustomer.findUnique.mockResolvedValue(null);
    prismaMock.paymentCustomer.upsert.mockResolvedValue(customer);
    prismaMock.savedPaymentMethod.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.savedPaymentMethod.upsert.mockResolvedValue({ id: 'local-card-1' });
    prismaMock.savedPaymentMethod.findFirst.mockResolvedValue({
      id: 'local-card-1',
      externalCardId: 'vault-card-1',
      paymentCustomer: customer,
    });
    prismaMock.savedPaymentMethod.delete.mockResolvedValue({ id: 'local-card-1' });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('requires authentication and marks the response private/no-store', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce(null);
    const response = await GET(new Request('https://shop.example/api/payment-methods/paypal'));
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(prismaMock.paymentCustomer.findUnique).not.toHaveBeenCalled();
  });

  it('returns an empty list without requesting PayPal when the user has no vault customer', async () => {
    const response = await GET(new Request('https://shop.example/api/payment-methods/paypal'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cards: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('synchronizes only masked cards returned by the PayPal vault for the current customer', async () => {
    const customerWithoutCards = { ...customer, cards: [] };
    const customerWithCard = {
      ...customer,
      cards: [
        {
          id: 'local-card-1',
          paymentMethodName: 'VISA',
          lastFourDigits: '4242',
          expirationMonth: 12,
          expirationYear: 2030,
        },
      ],
    };
    prismaMock.paymentCustomer.findUnique
      .mockResolvedValueOnce(customerWithoutCards)
      .mockResolvedValueOnce(customer)
      .mockResolvedValueOnce(customer)
      .mockResolvedValueOnce(customerWithCard);
    prismaMock.savedPaymentMethod.upsert.mockResolvedValue({ id: 'local-card-1' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'oauth-token' }))
      .mockResolvedValueOnce(
        jsonResponse({
          payment_tokens: [
            {
              id: 'vault-card-1',
              customer: { id: 'paypal-customer-1' },
              payment_source: { card: { brand: 'VISA', last_digits: '4242', expiry: '2030-12' } },
            },
          ],
        }),
      );

    const response = await GET(new Request('https://shop.example/api/payment-methods/paypal'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cards: [
        {
          id: 'local-card-1',
          brand: 'Visa',
          lastFourDigits: '4242',
          expirationMonth: 12,
          expirationYear: 2030,
        },
      ],
    });
    expect(prismaMock.savedPaymentMethod.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          externalCardId: 'vault-card-1',
          lastFourDigits: '4242',
          paymentMethodId: 'card',
        }),
      }),
    );
    expect(JSON.stringify(await response.json().catch(() => ({}))).toLowerCase()).not.toContain(
      'cvv',
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });

  it('does not remove a vault token belonging to another user', async () => {
    prismaMock.savedPaymentMethod.findFirst.mockResolvedValueOnce(null);
    const response = await DELETE(deleteRequest('foreign-card'));
    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
    expect(prismaMock.savedPaymentMethod.delete).not.toHaveBeenCalled();
  });

  it('deletes a card from PayPal Vault before deleting its local metadata', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'oauth-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await DELETE(deleteRequest('local-card-1'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe(
      'https://api-m.sandbox.paypal.com/v3/vault/payment-tokens/vault-card-1',
    );
    expect(vi.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(prismaMock.savedPaymentMethod.delete).toHaveBeenCalledWith({
      where: { id: 'local-card-1' },
    });
  });
});
