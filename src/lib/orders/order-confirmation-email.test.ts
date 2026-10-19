import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, sendEmailMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findUnique: vi.fn() },
    orderEmailNotification: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  },
  sendEmailMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/email/brevo', () => ({
  createBrevoIdempotencyKey: (seed: string) => 'key-' + seed,
  sendBrevoEmail: sendEmailMock,
}));

import { sendOrderConfirmationEmail } from './order-confirmation-email';

const paidOrder = {
  id: 'order-1',
  orderNumber: 1042,
  status: 'PAID',
  total: 12500,
  currency: 'ARS',
  paymentTotal: null,
  paymentCurrency: 'ARS',
  paymentProvider: 'STRIPE',
  createdAt: new Date('2026-10-17T12:00:00.000Z'),
  user: {
    email: 'buyer@example.com',
    firstName: 'Ana',
    name: 'Ana Buyer',
  },
  items: [
    {
      title: 'Botas <deportivas> & medias',
      price: 12500,
      quantity: 1,
      size: '38',
    },
  ],
};

const pendingNotification = {
  id: 'notification-1',
  status: 'PENDING',
  recipientEmail: 'buyer@example.com',
  attempts: 0,
};

describe('sendOrderConfirmationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.order.findUnique.mockResolvedValue(paidOrder);
    prismaMock.orderEmailNotification.upsert.mockResolvedValue(pendingNotification);
    prismaMock.orderEmailNotification.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.orderEmailNotification.update.mockResolvedValue({});
    sendEmailMock.mockResolvedValue({ messageId: 'brevo-message-1', deduplicated: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sends a Spanish confirmation with the order number and escaped product text', async () => {
    await sendOrderConfirmationEmail(paidOrder.id);

    expect(sendEmailMock).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        toName: 'Ana',
        subject: 'Compra confirmada · Pedido #1042',
        html: expect.stringContaining('Botas &lt;deportivas&gt; &amp; medias'),
        text: expect.stringContaining('#1042'),
        idempotencyKey: 'key-purchase-confirmation:notification-1',
      }),
    );
    expect(prismaMock.orderEmailNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SENT',
          providerMessageId: 'brevo-message-1',
          sentAt: expect.any(Date),
        }),
      }),
    );
  });

  it('shows the provider amount when it differs from the order currency', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      ...paidOrder,
      paymentTotal: 45.5,
      paymentCurrency: 'USD',
    });

    await sendOrderConfirmationEmail(paidOrder.id);

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Importe enviado al medio de pago'),
        text: expect.stringContaining('Importe enviado al medio de pago:'),
        idempotencyKey: 'key-purchase-confirmation:notification-1',
      }),
    );
  });

  it('does not send a confirmation before payment is confirmed', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...paidOrder, status: 'PENDING' });

    await sendOrderConfirmationEmail(paidOrder.id);

    expect(prismaMock.orderEmailNotification.upsert).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('does not send a duplicate when the notification is already sent', async () => {
    prismaMock.orderEmailNotification.upsert.mockResolvedValue({
      ...pendingNotification,
      status: 'SENT',
    });

    await sendOrderConfirmationEmail(paidOrder.id);

    expect(prismaMock.orderEmailNotification.updateMany).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('marks failed deliveries for retry without failing order confirmation', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('Temporary delivery failure.'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(sendOrderConfirmationEmail(paidOrder.id)).resolves.toBeUndefined();

    expect(prismaMock.orderEmailNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notification-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          lastError: 'Temporary delivery failure.',
        }),
      }),
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it('retries an existing failed notification', async () => {
    prismaMock.orderEmailNotification.upsert.mockResolvedValue({
      ...pendingNotification,
      status: 'FAILED',
      attempts: 1,
    });

    await sendOrderConfirmationEmail(paidOrder.id);

    expect(prismaMock.orderEmailNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'notification-1',
          OR: expect.arrayContaining([{ status: { in: ['PENDING', 'FAILED'] } }]),
        }),
      }),
    );
    expect(sendEmailMock).toHaveBeenCalledOnce();
    expect(prismaMock.orderEmailNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notification-1' },
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
  });
});
