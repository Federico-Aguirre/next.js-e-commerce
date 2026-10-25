import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  transactionUpdateManyMock,
  restoreOrderStockMock,
  sendConfirmationMock,
  sendPaidOrderAlertMock,
  sendLowStockAlertsMock,
  mercadoPagoConfigMock,
  paypalConfigMock,
  stripeConfigMock,
} = vi.hoisted(() => {
  const transactionUpdateManyMock = vi.fn();
  return {
    transactionUpdateManyMock,
    prismaMock: {
      order: { findMany: vi.fn(), updateMany: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({ order: { updateMany: transactionUpdateManyMock } }),
      ),
    },
    restoreOrderStockMock: vi.fn(),
    sendConfirmationMock: vi.fn(),
    sendPaidOrderAlertMock: vi.fn(),
    sendLowStockAlertsMock: vi.fn(),
    mercadoPagoConfigMock: vi.fn(),
    paypalConfigMock: vi.fn(),
    stripeConfigMock: vi.fn(),
  };
});

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/checkout/inventory', () => ({ restoreOrderStock: restoreOrderStockMock }));
vi.mock('@/lib/orders/order-confirmation-email', () => ({
  sendOrderConfirmationEmail: sendConfirmationMock,
}));
vi.mock('@/lib/order-alerts', () => ({
  sendPaidOrderAlert: sendPaidOrderAlertMock,
  sendLowStockAlerts: sendLowStockAlertsMock,
}));
vi.mock('@/lib/payments/platform-config', () => ({
  mercadoPagoPaymentConfig: mercadoPagoConfigMock,
  paypalAuthAssertion: vi.fn(),
  paypalPaymentConfig: paypalConfigMock,
  stripePaymentConfig: stripeConfigMock,
}));

import { expireStaleCheckoutOrders } from './expired-checkout-cleanup';

const now = new Date('2026-10-21T15:00:00.000Z');
const expiredOrder = {
  id: 'order-expired',
  status: 'PENDING',
  paymentProvider: null,
  paymentExternalId: null,
  createdAt: new Date('2026-10-21T14:00:00.000Z'),
  expiresAt: new Date('2026-10-21T14:15:00.000Z'),
  updatedAt: new Date('2026-10-21T14:15:00.000Z'),
  items: [{ productId: '1234', size: 'M', quantity: 2 }],
};

describe('expireStaleCheckoutOrders', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    prismaMock.order.findMany.mockResolvedValue([expiredOrder]);
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    transactionUpdateManyMock.mockResolvedValue({ count: 1 });
    restoreOrderStockMock.mockResolvedValue(undefined);
    sendConfirmationMock.mockResolvedValue(undefined);
    sendPaidOrderAlertMock.mockResolvedValue(undefined);
    sendLowStockAlertsMock.mockResolvedValue(undefined);
    mercadoPagoConfigMock.mockResolvedValue({ accessToken: null });
    paypalConfigMock.mockResolvedValue({ clientId: null, clientSecret: null });
    stripeConfigMock.mockResolvedValue({ secretKey: null });
  });

  it('marks an expired order and restores stock in the same transaction exactly once', async () => {
    const result = await expireStaleCheckoutOrders({ now, limit: 10 });

    expect(result).toEqual({
      examined: 1,
      expired: 1,
      reconciledPaid: 0,
      deferred: 0,
      errors: 0,
    });
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: expiredOrder.id, status: 'PENDING' }),
        data: { status: 'EXPIRING' },
      }),
    );
    expect(transactionUpdateManyMock).toHaveBeenCalledWith({
      where: { id: expiredOrder.id, status: 'EXPIRING' },
      data: { status: 'EXPIRED' },
    });
    expect(restoreOrderStockMock).toHaveBeenCalledOnce();
    expect(restoreOrderStockMock).toHaveBeenCalledWith(expect.anything(), expiredOrder.items);
  });

  it('does not restore stock when another request already claimed the reservation', async () => {
    prismaMock.order.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await expireStaleCheckoutOrders({ now });

    expect(result.expired).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(restoreOrderStockMock).not.toHaveBeenCalled();
  });

  it('keeps stock reserved when the payment provider cannot be verified', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { ...expiredOrder, paymentProvider: 'STRIPE', paymentExternalId: 'pi_test' },
    ]);

    const result = await expireStaleCheckoutOrders({ now });

    expect(result.deferred).toBe(1);
    expect(result.expired).toBe(0);
    expect(restoreOrderStockMock).not.toHaveBeenCalled();
    expect(prismaMock.order.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: expiredOrder.id, status: 'EXPIRING' },
        data: { status: 'PENDING' },
      }),
    );
  });

  it('reconciles an externally approved Mercado Pago payment without restoring stock', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { ...expiredOrder, paymentProvider: 'MERCADOPAGO' },
    ]);
    mercadoPagoConfigMock.mockResolvedValue({ accessToken: 'server-side-test-token' });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                id: 98765,
                external_reference: expiredOrder.id,
                status: 'approved',
                status_detail: 'accredited',
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await expireStaleCheckoutOrders({ now });

    expect(result.reconciledPaid).toBe(1);
    expect(result.expired).toBe(0);
    expect(prismaMock.order.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: expiredOrder.id, status: 'EXPIRING' },
        data: { status: 'PAID', paymentExternalId: '98765' },
      }),
    );
    expect(sendConfirmationMock).toHaveBeenCalledWith(expiredOrder.id);
    expect(restoreOrderStockMock).not.toHaveBeenCalled();
  });
});
