import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAuthenticatedUserMock,
  checkRateLimitMock,
  hashRateLimitIdentityMock,
  paymentConfigMock,
  intentRetrieveMock,
  orderFindFirstMock,
  orderUpdateManyMock,
  paymentCustomerFindUniqueMock,
  syncStripeSavedCardsMock,
  sendOrderConfirmationEmailMock,
  sendPaidOrderAlertMock,
  sendLowStockAlertsMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  hashRateLimitIdentityMock: vi.fn(),
  paymentConfigMock: vi.fn(),
  intentRetrieveMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
  paymentCustomerFindUniqueMock: vi.fn(),
  syncStripeSavedCardsMock: vi.fn(),
  sendOrderConfirmationEmailMock: vi.fn(),
  sendPaidOrderAlertMock: vi.fn(),
  sendLowStockAlertsMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/request-user', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  hashRateLimitIdentity: hashRateLimitIdentityMock,
}));
vi.mock('@/lib/payments/platform-config', () => ({
  stripePaymentConfig: paymentConfigMock,
  refreshPlatformSubscriptionPlan: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/payments/stripe-saved-cards', () => ({
  getStripeSavedCardScope: vi.fn(() => 'stripe-sandbox-scope'),
  syncStripeSavedCards: syncStripeSavedCardsMock,
}));
vi.mock('@/lib/order-alerts', () => ({
  sendLowStockAlerts: sendLowStockAlertsMock,
  sendPaidOrderAlert: sendPaidOrderAlertMock,
}));
vi.mock('@/lib/orders/order-confirmation-email', () => ({
  sendOrderConfirmationEmail: sendOrderConfirmationEmailMock,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findFirst: orderFindFirstMock, updateMany: orderUpdateManyMock },
    paymentCustomer: { findUnique: paymentCustomerFindUniqueMock },
  },
}));
vi.mock('stripe', () => ({
  default: class StripeMock {
    paymentIntents = { retrieve: intentRetrieveMock };
  },
}));

import { POST } from './route';

const user = { id: 'buyer-1', email: 'buyer@example.test' };
const order = {
  id: 'order-1',
  userId: user.id,
  status: 'PENDING',
  paymentProvider: 'STRIPE',
  paymentExternalId: 'pi_test_1',
  paymentTotal: 12,
  total: 12,
  paymentCurrency: 'USD',
  expiresAt: new Date(Date.now() + 5 * 60_000),
};
const paymentIntent = {
  id: 'pi_test_1',
  metadata: { orderId: 'order-1', userId: user.id },
  amount: 1200,
  currency: 'usd',
  status: 'succeeded',
  customer: 'cus_test_1',
  payment_method: 'pm_test_1',
};

function post() {
  return POST(
    new Request('https://shop.example/api/stripe/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentIntentId: 'pi_test_1', orderId: 'order-1' }),
    }),
  );
}

describe('POST /api/stripe/confirm saved-card sync', () => {
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
    orderFindFirstMock.mockResolvedValue(order);
    orderUpdateManyMock.mockResolvedValue({ count: 1 });
    paymentCustomerFindUniqueMock.mockResolvedValue({
      id: 'local-customer-1',
      externalCustomerId: 'cus_test_1',
    });
    intentRetrieveMock.mockResolvedValue(paymentIntent);
    syncStripeSavedCardsMock.mockResolvedValue([]);
    sendOrderConfirmationEmailMock.mockResolvedValue(undefined);
    sendPaidOrderAlertMock.mockResolvedValue(undefined);
    sendLowStockAlertsMock.mockResolvedValue(undefined);
  });

  it('syncs a customer-owned stored card after the provider confirms a successful payment', async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, orderId: 'order-1' });
    expect(paymentCustomerFindUniqueMock).toHaveBeenCalledWith({
      where: {
        userId_provider_accountScope: {
          userId: user.id,
          provider: 'STRIPE',
          accountScope: 'stripe-sandbox-scope',
        },
      },
    });
    expect(syncStripeSavedCardsMock).toHaveBeenCalledWith(
      expect.any(Object),
      'local-customer-1',
      'cus_test_1',
    );
    expect(orderUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order-1',
          status: 'PENDING',
          paymentExternalId: 'pi_test_1',
        }),
        data: { status: 'PAID' },
      }),
    );
  });

  it('does not access any order or payment data for anonymous callers', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce(null);
    const response = await post();
    expect(response.status).toBe(401);
    expect(orderFindFirstMock).not.toHaveBeenCalled();
    expect(intentRetrieveMock).not.toHaveBeenCalled();
  });
});
