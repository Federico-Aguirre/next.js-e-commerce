import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  orderFindUniqueMock,
  orderUpdateManyMock,
  transactionMock,
  restoreOrderStockMock,
  sendLowStockAlertsMock,
  sendPaidOrderAlertMock,
  sendPaymentReviewAlertMock,
  sendOrderConfirmationEmailMock,
  mercadoPagoPaymentConfigMock,
  fetchMock,
} = vi.hoisted(() => ({
  orderFindUniqueMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
  transactionMock: vi.fn(),
  restoreOrderStockMock: vi.fn(),
  sendLowStockAlertsMock: vi.fn(),
  sendPaidOrderAlertMock: vi.fn(),
  sendPaymentReviewAlertMock: vi.fn(),
  sendOrderConfirmationEmailMock: vi.fn(),
  mercadoPagoPaymentConfigMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('@/lib/Env', () => ({
  Env: { MERCADOPAGO_WEBHOOK_SECRET: 'unit-test-webhook-secret' },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: orderFindUniqueMock,
      updateMany: orderUpdateManyMock,
    },
    $transaction: transactionMock,
  },
}));
vi.mock('@/lib/checkout/inventory', () => ({
  restoreOrderStock: restoreOrderStockMock,
}));
vi.mock('@/lib/order-alerts', () => ({
  sendLowStockAlerts: sendLowStockAlertsMock,
  sendPaidOrderAlert: sendPaidOrderAlertMock,
  sendPaymentReviewAlert: sendPaymentReviewAlertMock,
}));
vi.mock('@/lib/orders/order-confirmation-email', () => ({
  sendOrderConfirmationEmail: sendOrderConfirmationEmailMock,
}));
vi.mock('@/lib/payments/platform-config', () => ({
  mercadoPagoPaymentConfig: mercadoPagoPaymentConfigMock,
  refreshPlatformSubscriptionPlan: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from './route';

const secret = 'unit-test-webhook-secret';
const orderId = 'local-order-123';
const providerOrderId = 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3';

function signedWebhook(
  topic: 'order' | 'payment',
  dataId: string,
  body: unknown,
  validSignature = true,
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const requestId = 'request-test-123';
  const manifest =
    'id:' + dataId.toLowerCase() + ';request-id:' + requestId + ';ts:' + timestamp + ';';
  const signature = createHmac('sha256', secret).update(manifest).digest('hex');

  return new Request(
    'https://store.example/api/webhooks/mercadopago?type=' +
      topic +
      '&data.id=' +
      encodeURIComponent(dataId),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
        'x-signature': 'ts=' + timestamp + ',v1=' + (validSignature ? signature : '0'.repeat(64)),
      },
      body: JSON.stringify(body),
    },
  );
}

function localOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: orderId,
    status: 'PAYMENT_PROCESSING',
    paymentProvider: 'MERCADOPAGO',
    paymentExternalId: null,
    paymentTotal: 200,
    paymentCurrency: 'ARS',
    expiresAt: new Date(Date.now() + 5 * 60_000),
    orderNumber: 25,
    total: 200,
    currency: 'ARS',
    items: [],
    refundStatus: null,
    ...overrides,
  };
}

function approvedOrderResource(overrides: Record<string, unknown> = {}) {
  return {
    id: providerOrderId,
    status: 'processed',
    status_detail: 'accredited',
    external_reference: orderId,
    currency_id: 'ARS',
    total_amount: '200.00',
    total_paid_amount: '200.00',
    transactions: {
      payments: [
        {
          id: 'PAY01JQ4S4KY8HWQ6NA5PXB65B3D3',
          status: 'processed',
          status_detail: 'accredited',
          amount: '200.00',
          paid_amount: '200.00',
        },
      ],
    },
    ...overrides,
  };
}

function providerJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/webhooks/mercadopago', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    mercadoPagoPaymentConfigMock.mockResolvedValue({ accessToken: 'server-test-token' });
    orderFindUniqueMock.mockResolvedValue(localOrder());
    orderUpdateManyMock.mockResolvedValue({ count: 1 });
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ order: { updateMany: orderUpdateManyMock } }),
    );
    restoreOrderStockMock.mockResolvedValue(undefined);
    sendLowStockAlertsMock.mockResolvedValue(undefined);
    sendPaidOrderAlertMock.mockResolvedValue(undefined);
    sendPaymentReviewAlertMock.mockResolvedValue(true);
    sendOrderConfirmationEmailMock.mockResolvedValue(undefined);
    fetchMock.mockResolvedValue(providerJson(approvedOrderResource()));
  });

  it('fetches the canonical Orders API resource and marks the owned order PAID', async () => {
    const response = await POST(
      signedWebhook('order', providerOrderId, { type: 'order', data: { id: providerOrderId } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      received: true,
      reconciled: true,
      orderId,
      status: 'PAID',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mercadopago.com/v1/orders/' + providerOrderId,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer server-test-token' }),
        cache: 'no-store',
      }),
    );
    expect(orderUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'PAID', paymentExternalId: providerOrderId },
      }),
    );
    expect(sendOrderConfirmationEmailMock).toHaveBeenCalledWith(orderId);
    expect(sendPaidOrderAlertMock).toHaveBeenCalledWith(orderId);
  });

  it('supports the legacy Payments API event using the provider payment resource', async () => {
    const paymentId = '123456789';
    fetchMock.mockResolvedValue(
      providerJson({
        id: Number(paymentId),
        status: 'approved',
        status_detail: 'accredited',
        external_reference: orderId,
        currency_id: 'ARS',
        transaction_amount: 200,
      }),
    );

    const response = await POST(
      signedWebhook('payment', paymentId, { type: 'payment', data: { id: paymentId } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'PAID', orderId });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mercadopago.com/v1/payments/' + paymentId,
      expect.any(Object),
    );
  });

  it('rejects an invalid signature before querying Mercado Pago', async () => {
    const response = await POST(
      signedWebhook(
        'order',
        providerOrderId,
        { type: 'order', data: { id: providerOrderId } },
        false,
      ),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it('returns a retryable error when the configured provider token is rejected', async () => {
    fetchMock.mockResolvedValue(providerJson({ message: 'unauthorized' }, 401));

    const response = await POST(
      signedWebhook('order', providerOrderId, { type: 'order', data: { id: providerOrderId } }),
    );

    expect(response.status).toBe(503);
    expect(orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it('acknowledges a simulator Data ID that does not exist at the provider', async () => {
    fetchMock.mockResolvedValue(providerJson({ message: 'not found' }, 404));

    const response = await POST(
      signedWebhook('order', providerOrderId, { type: 'order', data: { id: providerOrderId } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, ignored: true });
    expect(orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it('moves an approved resource with a mismatched amount to manual review', async () => {
    fetchMock.mockResolvedValue(
      providerJson(approvedOrderResource({ total_paid_amount: '199.00' })),
    );

    const response = await POST(
      signedWebhook('order', providerOrderId, { type: 'order', data: { id: providerOrderId } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'PAYMENT_REVIEW', reconciled: false });
    expect(orderUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PAYMENT_REVIEW',
          paymentExternalId: providerOrderId,
        }),
      }),
    );
    expect(sendPaymentReviewAlertMock).toHaveBeenCalledWith(orderId, 'amount_or_currency_mismatch');
    expect(sendOrderConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it('restores stock once when Mercado Pago confirms a terminal failure', async () => {
    fetchMock.mockResolvedValue(
      providerJson(
        approvedOrderResource({
          status: 'failed',
          status_detail: 'failed',
          total_paid_amount: '0.00',
          transactions: { payments: [] },
        }),
      ),
    );

    const response = await POST(
      signedWebhook('order', providerOrderId, { type: 'order', data: { id: providerOrderId } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'PAYMENT_FAILED', reconciled: true });
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(restoreOrderStockMock).toHaveBeenCalledOnce();
  });
});
