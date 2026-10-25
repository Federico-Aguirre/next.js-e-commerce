import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAuthenticatedUserMock,
  checkRateLimitMock,
  hashRateLimitIdentityMock,
  paymentConfigMock,
  stripeIntentRetrieveMock,
  stripeIntentUpdateMock,
  stripeCustomerRetrieveMock,
  stripeCustomerCreateMock,
  stripePaymentMethodRetrieveMock,
  prismaMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  hashRateLimitIdentityMock: vi.fn(),
  paymentConfigMock: vi.fn(),
  stripeIntentRetrieveMock: vi.fn(),
  stripeIntentUpdateMock: vi.fn(),
  stripeCustomerRetrieveMock: vi.fn(),
  stripeCustomerCreateMock: vi.fn(),
  stripePaymentMethodRetrieveMock: vi.fn(),
  prismaMock: {
    order: { findFirst: vi.fn() },
    paymentCustomer: { findUnique: vi.fn(), upsert: vi.fn() },
    savedPaymentMethod: { findFirst: vi.fn(), deleteMany: vi.fn() },
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
    paymentIntents = { retrieve: stripeIntentRetrieveMock, update: stripeIntentUpdateMock };
    customers = { retrieve: stripeCustomerRetrieveMock, create: stripeCustomerCreateMock };
    paymentMethods = { retrieve: stripePaymentMethodRetrieveMock };
  },
}));

import { POST } from './route';

const user = { id: 'stripe-user-1', email: 'buyer@example.test', name: 'Test Buyer' };
const order = {
  id: 'order-1',
  userId: user.id,
  status: 'PENDING',
  paymentProvider: 'STRIPE',
  paymentExternalId: 'pi_test_1',
  expiresAt: new Date(Date.now() + 5 * 60_000),
  paymentTotal: 120,
  total: 120,
  paymentCurrency: 'USD',
};
const intent = {
  id: 'pi_test_1',
  metadata: { orderId: order.id, userId: user.id },
  amount: 12_000,
  currency: 'usd',
  status: 'requires_payment_method',
  setup_future_usage: null,
};

function post(body: Record<string, unknown>) {
  return POST(
    new Request('https://shop.example/api/stripe/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentIntentId: 'pi_test_1', orderId: 'order-1', ...body }),
    }),
  );
}

describe('POST /api/stripe/prepare', () => {
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
    prismaMock.order.findFirst.mockResolvedValue(order);
    prismaMock.paymentCustomer.findUnique.mockResolvedValue(null);
    prismaMock.paymentCustomer.upsert.mockResolvedValue({
      id: 'local-customer-1',
      externalCustomerId: 'cus_test_1',
    });
    prismaMock.savedPaymentMethod.findFirst.mockResolvedValue({
      id: 'saved-card-1',
      externalCardId: 'pm_visa_4242',
      paymentCustomer: { id: 'local-customer-1', externalCustomerId: 'cus_test_1' },
    });
    prismaMock.savedPaymentMethod.deleteMany.mockResolvedValue({ count: 0 });
    stripeIntentRetrieveMock.mockResolvedValue({ ...intent });
    stripeIntentUpdateMock.mockImplementation(async (id: string, params: unknown) => ({
      id,
      ...(params as object),
    }));
    stripeCustomerRetrieveMock.mockResolvedValue({
      id: 'cus_test_1',
      metadata: { userId: user.id },
    });
    stripeCustomerCreateMock.mockResolvedValue({ id: 'cus_test_1', metadata: { userId: user.id } });
    stripePaymentMethodRetrieveMock.mockResolvedValue({
      id: 'pm_visa_4242',
      type: 'card',
      customer: 'cus_test_1',
    });
  });

  it('rejects anonymous callers before touching payment records', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce(null);
    const response = await post({ savePaymentMethod: true });
    expect(response.status).toBe(401);
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
  });

  it('attaches a Stripe Customer and requests on-session setup only after an opt-in', async () => {
    const response = await post({ savePaymentMethod: true });
    expect(response.status).toBe(200);
    expect(stripeIntentUpdateMock).toHaveBeenCalledWith('pi_test_1', {
      customer: 'cus_test_1',
      setup_future_usage: 'on_session',
    });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });

  it('uses only a saved PaymentMethod owned by the authenticated user and attaches it to the PaymentIntent', async () => {
    const response = await post({ savedPaymentMethodId: 'saved-card-1' });
    expect(response.status).toBe(200);
    expect(prismaMock.savedPaymentMethod.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'saved-card-1',
          paymentCustomer: expect.objectContaining({ userId: user.id, provider: 'STRIPE' }),
        }),
      }),
    );
    expect(stripeIntentUpdateMock).toHaveBeenCalledWith('pi_test_1', {
      customer: 'cus_test_1',
      payment_method: 'pm_visa_4242',
    });
  });

  it('rejects a saved card that is not owned by the current user', async () => {
    prismaMock.savedPaymentMethod.findFirst.mockResolvedValueOnce(null);
    const response = await post({ savedPaymentMethodId: 'foreign-card' });
    expect(response.status).toBe(404);
    expect(stripeIntentUpdateMock).not.toHaveBeenCalled();
  });
});
