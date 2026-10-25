import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, sendConfirmationMock, sendFulfillmentMock, refreshShippingMock } = vi.hoisted(
  () => ({
    prismaMock: {
      order: { findMany: vi.fn(), updateMany: vi.fn() },
      orderEmailNotification: { findMany: vi.fn(), findUnique: vi.fn() },
    },
    sendConfirmationMock: vi.fn(),
    sendFulfillmentMock: vi.fn(),
    refreshShippingMock: vi.fn(),
  }),
);

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/orders/order-confirmation-email', () => ({
  sendOrderConfirmationEmail: sendConfirmationMock,
}));
vi.mock('@/lib/orders/order-fulfillment-email', () => ({
  sendOrderFulfillmentEmail: sendFulfillmentMock,
}));
vi.mock('@/lib/shipping/order-shipping', () => ({
  refreshOrderShipping: refreshShippingMock,
}));

import {
  monitorStaleShipmentCreations,
  refreshInTransitShipments,
  retryOrderEmails,
} from './operational-maintenance';

describe('retryOrderEmails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendConfirmationMock.mockResolvedValue(undefined);
    sendFulfillmentMock.mockResolvedValue(true);
    prismaMock.orderEmailNotification.findMany.mockResolvedValue([]);
    prismaMock.orderEmailNotification.findUnique.mockResolvedValue({ status: 'SENT' });
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    refreshShippingMock.mockResolvedValue({ success: true });
  });

  it('retries old paid-order confirmation notifications and records the result', async () => {
    prismaMock.orderEmailNotification.findMany.mockResolvedValue([
      { orderId: 'order-paid', type: 'PURCHASE_CONFIRMATION' },
    ]);

    const result = await retryOrderEmails({
      now: new Date('2026-10-21T15:00:00.000Z'),
      limit: 5,
    });

    expect(result).toEqual({ examined: 1, attempted: 1, sent: 1, failed: 0 });
    expect(prismaMock.orderEmailNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          attempts: { lt: 8 },
          order: { status: 'PAID' },
        }),
        take: 5,
      }),
    );
    expect(sendConfirmationMock).toHaveBeenCalledWith('order-paid');
    expect(prismaMock.orderEmailNotification.findUnique).toHaveBeenCalledWith({
      where: {
        orderId_type: { orderId: 'order-paid', type: 'PURCHASE_CONFIRMATION' },
      },
      select: { status: true },
    });
  });

  it('retries fulfillment notifications with the original event version', async () => {
    prismaMock.orderEmailNotification.findMany.mockResolvedValue([
      { orderId: 'order-shipped', type: 'DELIVERY_ESTIMATE_UPDATED_1761060000000' },
    ]);
    prismaMock.orderEmailNotification.findUnique.mockResolvedValue({ status: 'FAILED' });

    const result = await retryOrderEmails();

    expect(result).toEqual({ examined: 1, attempted: 1, sent: 0, failed: 1 });
    expect(sendFulfillmentMock).toHaveBeenCalledWith('order-shipped', 'DELIVERY_ESTIMATE_UPDATED', {
      eventVersion: '1761060000000',
    });
  });
});

describe('monitorStaleShipmentCreations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
  });

  it('flags stale shipments for provider reconciliation without freeing the creation lock', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { id: 'order-shipping-stuck', shippingError: null },
    ]);

    const result = await monitorStaleShipmentCreations({
      now: new Date('2026-10-21T15:00:00.000Z'),
      limit: 3,
    });

    expect(result).toEqual({ examined: 1, flagged: 1, failed: 0 });
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order-shipping-stuck',
          status: 'PAID',
          shippingStatus: 'CREATING',
          shippingExternalId: null,
          shippingError: null,
        }),
        data: {
          shippingError: expect.stringContaining('confirmá si la etiqueta existe'),
        },
      }),
    );
  });

  it('does not overwrite an existing provider error or automatically unlock the shipment', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { id: 'order-shipping-stuck', shippingError: 'fetch failed' },
    ]);

    const result = await monitorStaleShipmentCreations();

    expect(result).toEqual({ examined: 1, flagged: 0, failed: 0 });
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
  });
});

describe('refreshInTransitShipments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    refreshShippingMock.mockResolvedValue({ success: true });
  });

  it('refreshes only old, paid, in-transit shipments in a bounded batch', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { id: 'order-shipped-1' },
      { id: 'order-shipped-2' },
    ]);

    const result = await refreshInTransitShipments({
      now: new Date('2026-10-21T15:00:00.000Z'),
      limit: 2,
    });

    expect(result).toEqual({ examined: 2, refreshed: 2, failed: 0 });
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PAID',
          fulfillmentStatus: 'SHIPPED',
          shippingProvider: { in: ['ZIPNOVA', 'SHIPPO'] },
          shippingExternalId: { not: null },
        }),
        take: 2,
      }),
    );
    expect(refreshShippingMock).toHaveBeenCalledTimes(2);
  });
});
