import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, sendEmailMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findUnique: vi.fn() },
    orderEmailNotification: { upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  },
  sendEmailMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/email/brevo', () => ({
  createBrevoIdempotencyKey: (seed: string) => `key-${seed}`,
  sendBrevoEmail: sendEmailMock,
}));

import { sendOrderFulfillmentEmail } from './order-fulfillment-email';

const order = {
  id: 'order-1',
  orderNumber: 42,
  status: 'PAID',
  fulfillmentStatus: 'SHIPPED',
  estimatedDeliveryAt: new Date('2026-10-20T17:30:00.000Z'),
  trackingCode: 'TRACK-123',
  shippingCarrier: 'Correo de prueba',
  shippingService: 'Estándar',
  shippingTrackingUrl: 'https://tracking.example/abc',
  user: { email: 'buyer@example.com', firstName: 'Ana', name: 'Ana Buyer' },
};
const notification = { id: 'email-1', status: 'PENDING', attempts: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findUnique.mockResolvedValue(order);
  prismaMock.orderEmailNotification.upsert.mockResolvedValue(notification);
  prismaMock.orderEmailNotification.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.orderEmailNotification.update.mockResolvedValue({});
  sendEmailMock.mockResolvedValue({ messageId: 'brevo-1', deduplicated: false });
});

afterEach(() => vi.restoreAllMocks());

describe('sendOrderFulfillmentEmail', () => {
  it('emails the customer when the order enters preparation', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...order, fulfillmentStatus: 'PREPARING' });
    expect(await sendOrderFulfillmentEmail(order.id, 'PREPARING')).toBe(true);
    expect(prismaMock.orderEmailNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId_type: { orderId: order.id, type: 'FULFILLMENT_PREPARING' } },
      }),
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Tu pedido #000042 está en preparación' }),
    );
  });

  it('emails the new estimate and tracking details when the order enters transit', async () => {
    expect(await sendOrderFulfillmentEmail(order.id, 'IN_TRANSIT')).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledOnce();
    const sentEmail = sendEmailMock.mock.calls[0]?.[0];
    expect(sentEmail.subject).toBe('Tu pedido #000042 está en camino');
    expect(sentEmail.html).toContain('Entrega estimada');
    expect(sentEmail.html).toContain('TRACK-123');
    expect(sentEmail.html).toContain('https://tracking.example/abc');
    expect(sentEmail.text).toContain('2026');
    expect(sentEmail.text).toContain('14:30');
  });

  it('sends a separate email when the estimated delivery changes', async () => {
    const previous = new Date('2026-10-19T17:30:00.000Z');
    expect(
      await sendOrderFulfillmentEmail(order.id, 'DELIVERY_ESTIMATE_UPDATED', {
        previousEstimatedDeliveryAt: previous,
        eventVersion: 'update-2',
      }),
    ).toBe(true);
    expect(prismaMock.orderEmailNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId_type: { orderId: order.id, type: 'DELIVERY_ESTIMATE_UPDATED_update-2' } },
      }),
    );
    expect(sendEmailMock).toHaveBeenCalledOnce();
    const sentEmail = sendEmailMock.mock.calls[0]?.[0];
    expect(sentEmail.subject).toBe('Actualización de entrega · Pedido #000042');
    expect(sentEmail.text).toContain('Estimación anterior');
    expect(sentEmail.text).toContain('Nueva entrega estimada');
  });

  it('does not send a transit email without a saved estimate', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...order, estimatedDeliveryAt: null });
    expect(await sendOrderFulfillmentEmail(order.id, 'IN_TRANSIT')).toBe(false);
    expect(prismaMock.orderEmailNotification.upsert).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('does not send another email when that event was already sent', async () => {
    prismaMock.orderEmailNotification.upsert.mockResolvedValue({ ...notification, status: 'SENT' });
    expect(await sendOrderFulfillmentEmail(order.id, 'IN_TRANSIT')).toBe(true);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
