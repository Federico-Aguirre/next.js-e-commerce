import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAuthenticatedUserMock,
  checkRateLimitMock,
  hashRateLimitIdentityMock,
  paymentConfigMock,
  stripeCustomerRetrieveMock,
  stripeCustomerCreateMock,
  stripePaymentMethodListMock,
  stripePaymentMethodRetrieveMock,
  stripePaymentMethodDetachMock,
  prismaMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  hashRateLimitIdentityMock: vi.fn(),
  paymentConfigMock: vi.fn(),
  stripeCustomerRetrieveMock: vi.fn(),
  stripeCustomerCreateMock: vi.fn(),
  stripePaymentMethodListMock: vi.fn(),
  stripePaymentMethodRetrieveMock: vi.fn(),
  stripePaymentMethodDetachMock: vi.fn(),
  prismaMock: {
    paymentCustomer: { findUnique: vi.fn(), upsert: vi.fn() },
    savedPaymentMethod: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
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
vi.mock('@/lib/payments/platform-config', () => ({ stripePaymentConfig: paymentConfigMock }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('stripe', () => ({
  default: class StripeMock {
    customers = { retrieve: stripeCustomerRetrieveMock, create: stripeCustomerCreateMock };
    paymentMethods = {
      list: stripePaymentMethodListMock,
      retrieve: stripePaymentMethodRetrieveMock,
      detach: stripePaymentMethodDetachMock,
    };
  },
}));

import { DELETE, GET } from './route';

const user = {
  id: 'stripe-user-1',
  email: 'buyer@example.test',
  firstName: 'Test',
  lastName: 'Buyer',
};
const localCustomer = {
  id: 'local-customer-1',
  userId: user.id,
  provider: 'STRIPE',
  accountScope: 'scope',
  externalCustomerId: 'cus_test_1',
};

function request(body?: unknown) {
  return new Request('https://shop.example/api/payment-methods/stripe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe('/api/payment-methods/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUserMock.mockResolvedValue(user);
    checkRateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    hashRateLimitIdentityMock.mockReturnValue('hashed-user');
    paymentConfigMock.mockResolvedValue({
      secretKey: 'sk_test_platform',
      splitEnabled: true,
      connectedAccountId: 'acct_test',
      sandbox: true,
    });
    prismaMock.paymentCustomer.findUnique.mockResolvedValue(localCustomer);
    prismaMock.paymentCustomer.upsert.mockResolvedValue(localCustomer);
    prismaMock.savedPaymentMethod.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.savedPaymentMethod.upsert.mockResolvedValue({});
    prismaMock.savedPaymentMethod.findMany.mockResolvedValue([
      {
        id: 'saved-card-1',
        externalCardId: 'pm_visa_4242',
        paymentMethodName: 'visa',
        lastFourDigits: '4242',
        expirationMonth: 12,
        expirationYear: 2030,
      },
    ]);
    prismaMock.savedPaymentMethod.findFirst.mockResolvedValue({
      id: 'saved-card-1',
      externalCardId: 'pm_visa_4242',
      paymentCustomer: localCustomer,
    });
    prismaMock.savedPaymentMethod.delete.mockResolvedValue({ id: 'saved-card-1' });
    stripeCustomerRetrieveMock.mockResolvedValue({
      id: 'cus_test_1',
      metadata: { userId: user.id },
    });
    stripeCustomerCreateMock.mockResolvedValue({
      id: 'cus_test_new',
      metadata: { userId: user.id },
    });
    stripePaymentMethodListMock.mockResolvedValue({
      data: [
        {
          id: 'pm_visa_4242',
          type: 'card',
          card: {
            brand: 'visa',
            display_brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2030,
          },
        },
      ],
    });
    stripePaymentMethodRetrieveMock.mockResolvedValue({
      id: 'pm_visa_4242',
      type: 'card',
      customer: 'cus_test_1',
    });
    stripePaymentMethodDetachMock.mockResolvedValue({ id: 'pm_visa_4242', customer: null });
  });

  afterEach(() => vi.restoreAllMocks());

  it('requires authentication and disables caching for private card metadata', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce(null);
    const response = await GET(new Request('https://shop.example/api/payment-methods/stripe'));
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(prismaMock.paymentCustomer.findUnique).not.toHaveBeenCalled();
  });

  it('lists only masked metadata from Stripe for the signed-in customer', async () => {
    const response = await GET(new Request('https://shop.example/api/payment-methods/stripe'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cards: [
        {
          id: 'saved-card-1',
          brand: 'Visa',
          lastFourDigits: '4242',
          expirationMonth: 12,
          expirationYear: 2030,
        },
      ],
    });
    expect(stripePaymentMethodListMock).toHaveBeenCalledWith({
      customer: 'cus_test_1',
      type: 'card',
    });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });

  it('refuses to delete a saved card belonging to another user', async () => {
    prismaMock.savedPaymentMethod.findFirst.mockResolvedValueOnce(null);
    const response = await DELETE(request({ savedPaymentMethodId: 'someone-elses-card' }));
    expect(response.status).toBe(404);
    expect(stripePaymentMethodDetachMock).not.toHaveBeenCalled();
  });

  it('detaches the validated Stripe PaymentMethod and removes only the local record', async () => {
    const response = await DELETE(request({ savedPaymentMethodId: 'saved-card-1' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(stripePaymentMethodDetachMock).toHaveBeenCalledWith('pm_visa_4242');
    expect(prismaMock.savedPaymentMethod.delete).toHaveBeenCalledWith({
      where: { id: 'saved-card-1' },
    });
  });
});
