import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, requireDashboardAdminMock, revalidatePathMock, sendFulfillmentEmailMock } =
  vi.hoisted(() => ({
    prismaMock: {
      order: { findUnique: vi.fn(), update: vi.fn() },
    },
    requireDashboardAdminMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    sendFulfillmentEmailMock: vi.fn(),
  }));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/order-alerts', () => ({ sendLowStockAlerts: vi.fn() }));
vi.mock('@/lib/orders/order-fulfillment-email', () => ({
  sendOrderFulfillmentEmail: sendFulfillmentEmailMock,
}));
vi.mock('@/lib/shipping/order-shipping', () => ({
  createOrderShipping: vi.fn(),
  quoteOrderShipping: vi.fn(),
  refreshOrderShipping: vi.fn(),
}));
vi.mock('./data', () => ({ requireDashboardAdmin: requireDashboardAdminMock }));

import { updateOrder } from './actions';

function orderForm(status: string, estimatedDeliveryAt = '') {
  const form = new FormData();
  form.set('orderId', 'order-local-pickup');
  form.set('fulfillmentStatus', status);
  form.set('trackingCode', '');
  form.set('estimatedDeliveryAt', estimatedDeliveryAt);
  form.set('locale', 'es');
  return form;
}

describe('updateOrder local pickup completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendFulfillmentEmailMock.mockResolvedValue(true);
    prismaMock.order.findUnique.mockResolvedValue({
      fulfillmentStatus: 'PREPARING',
      deliveredAt: null,
      shippingProvider: 'LOCAL',
      shippingStatus: 'READY_FOR_PICKUP',
    });
    prismaMock.order.update.mockResolvedValue({
      updatedAt: new Date(),
      estimatedDeliveryAt: null,
      fulfillmentStatus: 'DELIVERED',
    });
  });

  it('allows a ready local pickup to be completed without shipping it', async () => {
    const result = await updateOrder(orderForm('DELIVERED'));

    expect(result).toEqual({ success: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-local-pickup' },
        data: expect.objectContaining({
          fulfillmentStatus: 'DELIVERED',
          deliveredAt: expect.any(Date),
          shippingStatus: 'PICKED_UP',
        }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/es/dashboard');
  });

  it('does not allow a non-local order in preparation to skip shipping', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      fulfillmentStatus: 'PREPARING',
      deliveredAt: null,
      shippingProvider: 'SHIPPO',
      shippingStatus: 'PRE_TRANSIT',
    });

    const result = await updateOrder(orderForm('DELIVERED'));

    expect(result).toEqual({ success: false });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });
});

describe('updateOrder delivery estimate and customer notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendFulfillmentEmailMock.mockResolvedValue(true);
    prismaMock.order.update.mockResolvedValue({
      updatedAt: new Date(),
      estimatedDeliveryAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      fulfillmentStatus: 'SHIPPED',
    });
    prismaMock.order.findUnique.mockResolvedValue({
      fulfillmentStatus: 'PREPARING',
      deliveredAt: null,
      shippingProvider: 'SHIPPO',
      shippingStatus: 'PRE_TRANSIT',
      estimatedDeliveryAt: null,
      status: 'PAID',
    });
  });

  it('rejects transition to in transit when no estimated date and time are provided', async () => {
    const result = await updateOrder(orderForm('SHIPPED'));
    expect(result).toEqual({ success: false, errorCode: 'ETA_REQUIRED' });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
    expect(sendFulfillmentEmailMock).not.toHaveBeenCalled();
  });

  it('saves a future estimate and emails the customer when the order enters transit', async () => {
    const estimate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const localValue = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(estimate);
    const part = (key: string) => localValue.find((value) => value.type === key)?.value ?? '';
    const input = `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
    const result = await updateOrder(orderForm('SHIPPED', input));

    expect(result).toEqual({ success: true, emailSent: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fulfillmentStatus: 'SHIPPED',
          estimatedDeliveryAt: expect.any(Date),
        }),
      }),
    );
    expect(sendFulfillmentEmailMock).toHaveBeenCalledWith('order-local-pickup', 'IN_TRANSIT');
  });

  it('sends a separate notification when an in-transit order estimate changes', async () => {
    const previousEstimate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    prismaMock.order.findUnique.mockResolvedValue({
      fulfillmentStatus: 'SHIPPED',
      deliveredAt: null,
      shippingProvider: 'SHIPPO',
      shippingStatus: 'TRANSIT',
      estimatedDeliveryAt: previousEstimate,
      status: 'PAID',
    });
    const estimate = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const localValue = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(estimate);
    const part = (key: string) => localValue.find((value) => value.type === key)?.value ?? '';
    const input = `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;

    const result = await updateOrder(orderForm('SHIPPED', input));
    expect(result).toEqual({ success: true, emailSent: true });
    expect(sendFulfillmentEmailMock).toHaveBeenCalledWith(
      'order-local-pickup',
      'DELIVERY_ESTIMATE_UPDATED',
      expect.objectContaining({
        eventVersion: expect.any(Number),
        previousEstimatedDeliveryAt: previousEstimate,
      }),
    );
  });
});
