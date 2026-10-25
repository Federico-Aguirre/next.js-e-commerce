import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAuthenticatedUserMock,
  checkRateLimitMock,
  hashRateLimitIdentityMock,
  paypalConfigMock,
  orderFindFirstMock,
  orderUpdateManyMock,
  orderFindUniqueMock,
  savedPaymentMethodFindFirstMock,
  persistVaultCardMock,
  persistVaultCustomerMock,
  sendOrderConfirmationEmailMock,
  sendPaidOrderAlertMock,
  sendLowStockAlertsMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  hashRateLimitIdentityMock: vi.fn(),
  paypalConfigMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
  orderFindUniqueMock: vi.fn(),
  savedPaymentMethodFindFirstMock: vi.fn(),
  persistVaultCardMock: vi.fn(),
  persistVaultCustomerMock: vi.fn(),
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
  paypalPaymentConfig: paypalConfigMock,
  paypalAuthAssertion: vi.fn(() => 'sandbox-auth-assertion'),
  refreshPlatformSubscriptionPlan: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/payments/paypal-saved-cards', () => ({
  getPayPalSavedCardScope: vi.fn(() => 'paypal-sandbox-scope'),
  persistPayPalVaultCard: persistVaultCardMock,
  persistPayPalVaultCustomer: persistVaultCustomerMock,
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
    order: {
      findFirst: orderFindFirstMock,
      updateMany: orderUpdateManyMock,
      findUnique: orderFindUniqueMock,
    },
    savedPaymentMethod: { findFirst: savedPaymentMethodFindFirstMock },
  },
}));

import { POST } from './route';

const user = { id: 'paypal-user-1', email: 'buyer@example.test' };
const order = {
  id: 'local-order-1',
  userId: user.id,
  status: 'PENDING',
  paymentProvider: 'PAYPAL',
  paymentExternalId: 'paypal-order-1',
  paymentCurrency: 'USD',
  paymentTotal: 10,
  total: 10,
  expiresAt: new Date(Date.now() + 5 * 60_000),
};
const savedCard = {
  id: 'local-card-1',
  externalCardId: 'vault-card-1',
  paymentCustomer: { id: 'customer-row-1', externalCustomerId: 'paypal-customer-1' },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function request(savedPaymentMethodId?: string) {
  return new Request('https://shop.example/api/paypal/capture-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paypalOrderId: 'paypal-order-1',
      orderId: 'local-order-1',
      ...(savedPaymentMethodId ? { savedPaymentMethodId } : {}),
    }),
  });
}

function captureResponse() {
  return {
    status: 'COMPLETED',
    payment_source: {
      card: {
        brand: 'VISA',
        last_digits: '4242',
        expiry: '2030-12',
        attributes: {
          vault: { id: 'vault-card-1', status: 'VAULTED', customer: { id: 'paypal-customer-1' } },
        },
      },
    },
    purchase_units: [
      {
        reference_id: 'local-order-1',
        amount: { currency_code: 'USD', value: '10.00' },
        payments: {
          captures: [
            {
              id: 'capture-1',
              status: 'COMPLETED',
              amount: { currency_code: 'USD', value: '10.00' },
            },
          ],
        },
      },
    ],
  };
}

describe('POST /api/paypal/capture-order saved card lifecycle', () => {
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
    orderFindFirstMock.mockResolvedValue(order);
    orderUpdateManyMock.mockResolvedValue({ count: 1 });
    orderFindUniqueMock.mockResolvedValue({ ...order, status: 'PAID', items: [] });
    savedPaymentMethodFindFirstMock.mockResolvedValue(savedCard);
    persistVaultCardMock.mockResolvedValue({ id: 'local-card-1' });
    persistVaultCustomerMock.mockResolvedValue({ id: 'local-paypal-customer-1' });
    sendOrderConfirmationEmailMock.mockResolvedValue(undefined);
    sendPaidOrderAlertMock.mockResolvedValue(undefined);
    sendLowStockAlertsMock.mockResolvedValue(undefined);
  });

  it('stores only the vault token and masked card metadata after a successfully captured opted-in card', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'sandbox-access-token' }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'paypal-order-1',
          status: 'APPROVED',
          purchase_units: [
            { reference_id: 'local-order-1', amount: { currency_code: 'USD', value: '10.00' } },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(captureResponse()));

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
    expect(persistVaultCustomerMock).toHaveBeenCalledWith({
      userId: user.id,
      sellerMerchantId: 'seller-sandbox-id',
      customerId: 'paypal-customer-1',
    });
    expect(persistVaultCardMock).toHaveBeenCalledWith({
      userId: user.id,
      sellerMerchantId: 'seller-sandbox-id',
      card: {
        id: 'vault-card-1',
        customerId: 'paypal-customer-1',
        brand: 'VISA',
        lastDigits: '4242',
        expiry: '2030-12',
      },
    });
    expect(orderUpdateManyMock).toHaveBeenCalledTimes(2);
    expect(orderUpdateManyMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: 'PAID', paymentExternalId: 'capture-1' } }),
    );
  });

  it('records the PayPal customer when vaulting is pending even before PayPal returns a vault token ID', async () => {
    const body = captureResponse();
    body.payment_source.card.attributes.vault.id = undefined as unknown as string;
    body.payment_source.card.attributes.vault.status = 'APPROVED';
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'sandbox-access-token' }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'paypal-order-1',
          status: 'APPROVED',
          purchase_units: [
            { reference_id: 'local-order-1', amount: { currency_code: 'USD', value: '10.00' } },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(body));

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(persistVaultCustomerMock).toHaveBeenCalledWith({
      userId: user.id,
      sellerMerchantId: 'seller-sandbox-id',
      customerId: 'paypal-customer-1',
    });
    expect(persistVaultCardMock).not.toHaveBeenCalled();
  });

  it('reuses a completed provider capture rather than requesting a second capture', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'sandbox-access-token' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'paypal-order-1', ...captureResponse() }));

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
    expect(fetch).toHaveBeenCalledTimes(2); // OAuth + order lookup; no /capture POST.
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/capture'))).toBe(
      false,
    );
    expect(orderUpdateManyMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { status: 'PAID', paymentExternalId: 'capture-1' },
      }),
    );
  });

  it('accepts a CREATED provider order only when the authenticated user owns the matching saved vault token', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'sandbox-access-token' }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'paypal-order-1',
          status: 'CREATED',
          payment_source: { card: { vault_id: 'vault-card-1' } },
          purchase_units: [
            { reference_id: 'local-order-1', amount: { currency_code: 'USD', value: '10.00' } },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(captureResponse()));

    const response = await POST(request('local-card-1'));
    expect(response.status).toBe(200);
    expect(savedPaymentMethodFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'local-card-1',
          paymentCustomer: expect.objectContaining({ userId: user.id, provider: 'PAYPAL' }),
        }),
      }),
    );
    expect(vi.mocked(fetch).mock.calls[2]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('does not create a capture request when the selected vault token is not owned by the user', async () => {
    savedPaymentMethodFindFirstMock.mockResolvedValueOnce(null);
    const response = await POST(request('foreign-card'));
    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
    expect(orderUpdateManyMock).not.toHaveBeenCalled();
  });

  it('requires an authenticated user before looking up or capturing the order', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(orderFindFirstMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
