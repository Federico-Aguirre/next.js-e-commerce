import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockProviderResponse = {
  status: number;
  body: unknown;
};

const {
  getAuthenticatedUserMock,
  checkRateLimitMock,
  hashRateLimitIdentityMock,
  paymentConfigMock,
  savedMethodFindFirstMock,
  orderFindFirstMock,
  orderUpdateManyMock,
  httpsRequestMock,
  providerResponses,
  capturedRequests,
  amountAtExchangeRateMock,
  calculateTaxBreakdownMock,
  platformFeeForProductsMock,
  sdkPaymentCreateMock,
  sdkConfigMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  hashRateLimitIdentityMock: vi.fn(),
  paymentConfigMock: vi.fn(),
  savedMethodFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
  httpsRequestMock: vi.fn(),
  providerResponses: [] as MockProviderResponse[],
  capturedRequests: [] as Array<{ options: Record<string, unknown>; body: string }>,
  amountAtExchangeRateMock: vi.fn(),
  calculateTaxBreakdownMock: vi.fn(),
  platformFeeForProductsMock: vi.fn(),
  sdkPaymentCreateMock: vi.fn(),
  sdkConfigMock: vi.fn(),
}));

vi.mock('node:https', () => ({ default: { request: httpsRequestMock } }));
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {
    constructor(options: unknown) {
      sdkConfigMock(options);
    }
  },
  Payment: class {
    create(options: unknown) {
      return sdkPaymentCreateMock(options);
    }
  },
}));
vi.mock('@/lib/auth/request-user', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  hashRateLimitIdentity: hashRateLimitIdentityMock,
}));
vi.mock('@/lib/payments/platform-config', () => ({
  mercadoPagoPaymentConfig: paymentConfigMock,
  platformFeeForProducts: platformFeeForProductsMock,
  refreshPlatformSubscriptionPlan: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    savedPaymentMethod: { findFirst: savedMethodFindFirstMock },
    order: { findFirst: orderFindFirstMock, updateMany: orderUpdateManyMock },
  },
}));
vi.mock('@/lib/checkout/inventory', () => ({ restoreOrderStock: vi.fn() }));
vi.mock('@/lib/currency/payment-amount', () => ({
  amountAtExchangeRate: amountAtExchangeRateMock,
}));
vi.mock('@/lib/order-alerts', () => ({
  sendLowStockAlerts: vi.fn(),
  sendPaidOrderAlert: vi.fn(),
}));
vi.mock('@/lib/orders/order-confirmation-email', () => ({
  sendOrderConfirmationEmail: vi.fn(),
}));
vi.mock('@/lib/tax/tax-calculation', () => ({
  calculateTaxBreakdown: calculateTaxBreakdownMock,
}));

import { getMercadoPagoSavedCardScope } from '@/lib/payments/mercadopago-saved-cards';
import { POST } from './route';

const user = { id: 'buyer-1', email: 'buyer@example.test' };

const pendingOrder = {
  id: 'order-1',
  userId: user.id,
  status: 'PENDING',
  paymentProvider: 'MERCADOPAGO',
  expiresAt: new Date(Date.now() + 5 * 60_000),
  paymentCurrency: 'ARS',
  paymentTotal: 100,
  paymentExchangeRate: 1,
  taxRate: 0,
  taxCalculationMethod: 'tax_exclusive_base',
  currency: 'ARS',
  items: [{ productId: 'product-1', title: 'Producto', price: 100, quantity: 1 }],
};

const savedCard = {
  id: 'local-card-1',
  externalCardId: 'mp-card-1',
  paymentMethodId: 'visa',
  paymentType: 'credit_card',
  paymentMethodName: 'Visa',
  lastFourDigits: '4242',
  expirationMonth: 12,
  expirationYear: 2030,
  paymentCustomer: { externalCustomerId: 'mp-customer-1' },
};

function paymentRequest(savedPaymentMethodId: string) {
  return new Request('https://shop.example/api/process-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: pendingOrder.id,
      token: 'one-time-cvv-token',
      email: user.email,
      savedPaymentMethodId,
    }),
  });
}

function mockHttpsRequest() {
  httpsRequestMock.mockImplementation(
    (
      options: Record<string, unknown>,
      callback: (
        response: EventEmitter & {
          statusCode: number;
          headers: Record<string, string>;
        },
      ) => void,
    ) => {
      const captured = { options, body: '' };
      capturedRequests.push(captured);

      const request = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        write: vi.fn((chunk: string | Buffer) => {
          captured.body += String(chunk);
          return true;
        }),
        end: vi.fn(() => {
          const providerResponse = providerResponses.shift() ?? {
            status: 500,
            body: { message: 'Missing mocked provider response' },
          };
          const response = new EventEmitter() as EventEmitter & {
            statusCode: number;
            headers: Record<string, string>;
          };
          response.statusCode = providerResponse.status;
          response.headers = { 'x-request-id': 'mp-test-request' };
          callback(response);
          response.emit('data', Buffer.from(JSON.stringify(providerResponse.body)));
          response.emit('end');
        }),
      };

      return request;
    },
  );
}

describe('POST /api/process-payment saved-card access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerResponses.length = 0;
    capturedRequests.length = 0;
    mockHttpsRequest();

    getAuthenticatedUserMock.mockResolvedValue(user);
    checkRateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    hashRateLimitIdentityMock.mockReturnValue('hashed-user');
    paymentConfigMock.mockResolvedValue({
      accessToken: 'sandbox-access-token',
      chargeEnabled: true,
      splitEnabled: false,
      sandbox: true,
      externalAccountId: undefined,
    });
    savedMethodFindFirstMock.mockResolvedValue(null);
    orderFindFirstMock.mockResolvedValue(null);
    orderUpdateManyMock.mockResolvedValue({ count: 1 });
    amountAtExchangeRateMock.mockImplementation((amount: number) => amount);
    calculateTaxBreakdownMock.mockReturnValue({ total: 100 });
    platformFeeForProductsMock.mockReturnValue(10);
    sdkPaymentCreateMock.mockResolvedValue({
      id: 'mp-payment-1',
      status: 'approved',
      status_detail: 'accredited',
      external_reference: pendingOrder.id,
    });
  });

  it('only searches for the saved card inside the authenticated user and configured account scope', async () => {
    const response = await POST(paymentRequest('another-users-card'));
    const body = await response.json();
    const expectedScope = getMercadoPagoSavedCardScope({
      accessToken: 'sandbox-access-token',
      splitEnabled: false,
    });

    expect(response.status).toBe(404);
    expect(body.message).toMatch(/no pertenece a esta cuenta/i);
    expect(savedMethodFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: 'another-users-card',
        paymentCustomer: {
          is: {
            userId: user.id,
            provider: 'MERCADOPAGO',
            accountScope: expectedScope,
          },
        },
      },
      include: { paymentCustomer: { select: { externalCustomerId: true } } },
    });
    expect(orderFindFirstMock).not.toHaveBeenCalled();
  });

  it('blocks saved-card payments outside sandbox before looking up the card', async () => {
    paymentConfigMock.mockResolvedValueOnce({
      accessToken: 'production-access-token',
      chargeEnabled: true,
      splitEnabled: false,
      sandbox: false,
      externalAccountId: undefined,
    });

    const response = await POST(paymentRequest('stored-card-1'));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      message: 'El pago con tarjetas guardadas solo está habilitado en sandbox por ahora.',
    });
    expect(savedMethodFindFirstMock).not.toHaveBeenCalled();
    expect(orderFindFirstMock).not.toHaveBeenCalled();
  });

  it('pays with the provider customer and stored card method, never a client-supplied card id', async () => {
    savedMethodFindFirstMock.mockResolvedValue(savedCard);
    orderFindFirstMock.mockResolvedValue(pendingOrder);
    providerResponses.push({
      status: 201,
      body: {
        id: 'mp-order-1',
        status: 'processed',
        status_detail: 'accredited',
        external_reference: pendingOrder.id,
        transactions: {
          payments: [{ status: 'processed', status_detail: 'accredited' }],
        },
      },
    });

    const response = await POST(paymentRequest(savedCard.id));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      id: 'mp-order-1',
      orderId: pendingOrder.id,
      status: 'approved',
      status_detail: 'accredited',
    });
    expect(savedMethodFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: savedCard.id }),
      }),
    );
    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0].options.path).toBe('/v1/orders');

    const orderBody = JSON.parse(capturedRequests[0].body);
    expect(orderBody.payer).toEqual({ customer_id: 'mp-customer-1' });
    expect(orderBody.transactions.payments[0].payment_method).toMatchObject({
      id: 'visa',
      type: 'credit_card',
      token: 'one-time-cvv-token',
      installments: 1,
    });
    expect(JSON.stringify(orderBody)).not.toContain('another-users-card');
    expect(orderUpdateManyMock).toHaveBeenCalledTimes(2);
  });

  it('uses the authenticated connected seller customer for a saved-card split payment', async () => {
    paymentConfigMock.mockResolvedValueOnce({
      accessToken: 'seller-sandbox-access-token',
      chargeEnabled: true,
      splitEnabled: true,
      sandbox: true,
      externalAccountId: 'seller-sandbox-1',
    });
    savedMethodFindFirstMock.mockResolvedValue(savedCard);
    orderFindFirstMock.mockResolvedValue(pendingOrder);

    const response = await POST(paymentRequest(savedCard.id));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      id: 'mp-payment-1',
      orderId: pendingOrder.id,
      status: 'approved',
      status_detail: 'accredited',
    });
    expect(savedMethodFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: savedCard.id,
          paymentCustomer: {
            is: {
              userId: user.id,
              provider: 'MERCADOPAGO',
              accountScope: 'sandbox-split-seller-sandbox-1',
            },
          },
        },
      }),
    );
    expect(sdkConfigMock).toHaveBeenCalledWith({ accessToken: 'seller-sandbox-access-token' });
    expect(sdkPaymentCreateMock).toHaveBeenCalledTimes(1);
    const paymentRequestBody = sdkPaymentCreateMock.mock.calls[0][0] as {
      body: Record<string, unknown>;
    };
    expect(paymentRequestBody.body.payer).toEqual({
      type: 'customer',
      id: 'mp-customer-1',
    });
    expect(paymentRequestBody.body).toMatchObject({
      token: 'one-time-cvv-token',
      payment_method_id: 'visa',
      application_fee: 10,
    });
    expect(capturedRequests).toHaveLength(0);
    expect(orderUpdateManyMock).toHaveBeenCalledTimes(2);
  });
});
