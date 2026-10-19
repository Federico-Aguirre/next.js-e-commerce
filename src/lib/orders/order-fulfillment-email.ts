import 'server-only';
import { createBrevoIdempotencyKey, sendBrevoEmail } from '@/lib/email/brevo';
import { prisma } from '@/lib/prisma';

export type OrderFulfillmentEmailEvent = 'PREPARING' | 'IN_TRANSIT' | 'DELIVERY_ESTIMATE_UPDATED';

type EmailOptions = {
  eventVersion?: string | number;
  previousEstimatedDeliveryAt?: Date | null;
};

const STALE_CLAIM_MS = 10 * 60 * 1000;
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return replacements[character] ?? character;
  });
}

function formatEstimate(value: Date | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'full',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
  }).format(value);
}

function safeTrackingUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function sendOrderFulfillmentEmail(
  orderId: string,
  event: OrderFulfillmentEmailEvent,
  options: EmailOptions = {},
): Promise<boolean> {
  let notificationId: string | undefined;
  let ownsClaim = false;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        fulfillmentStatus: true,
        estimatedDeliveryAt: true,
        trackingCode: true,
        shippingCarrier: true,
        shippingService: true,
        shippingTrackingUrl: true,
        user: { select: { email: true, firstName: true, name: true } },
      },
    });

    if (!order || order.status !== 'PAID' || !order.user.email?.trim()) return false;
    if (event === 'PREPARING' && order.fulfillmentStatus !== 'PREPARING') return false;
    if (event === 'IN_TRANSIT' && order.fulfillmentStatus !== 'SHIPPED') return false;
    if (event === 'DELIVERY_ESTIMATE_UPDATED' && order.fulfillmentStatus !== 'SHIPPED')
      return false;
    if (event !== 'PREPARING' && !order.estimatedDeliveryAt) return false;

    const eventType =
      event === 'PREPARING'
        ? 'FULFILLMENT_PREPARING'
        : event === 'IN_TRANSIT'
          ? 'FULFILLMENT_IN_TRANSIT'
          : `DELIVERY_ESTIMATE_UPDATED_${String(options.eventVersion ?? order.estimatedDeliveryAt!.getTime())}`;
    const notification = await prisma.orderEmailNotification.upsert({
      where: { orderId_type: { orderId, type: eventType } },
      create: {
        orderId,
        type: eventType,
        recipientEmail: order.user.email.trim().toLowerCase(),
        status: 'PENDING',
      },
      update: {},
    });
    notificationId = notification.id;
    if (notification.status === 'SENT') return true;

    const claim = await prisma.orderEmailNotification.updateMany({
      where: {
        id: notification.id,
        OR: [
          { status: { in: ['PENDING', 'FAILED'] } },
          { status: 'SENDING', updatedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } },
        ],
      },
      data: { status: 'SENDING', attempts: { increment: 1 }, lastError: null },
    });
    if (claim.count !== 1) return false;
    ownsClaim = true;

    const number = String(order.orderNumber).padStart(6, '0');
    const customerName = order.user.firstName || order.user.name || 'cliente';
    const estimate = formatEstimate(order.estimatedDeliveryAt);
    const oldEstimate = formatEstimate(options.previousEstimatedDeliveryAt);
    const trackingUrl = safeTrackingUrl(order.shippingTrackingUrl);
    const trackingRows = [
      order.shippingCarrier ? `Transportista: ${order.shippingCarrier}` : null,
      order.shippingService ? `Servicio: ${order.shippingService}` : null,
      order.trackingCode ? `Código de seguimiento: ${order.trackingCode}` : null,
    ].filter((value): value is string => Boolean(value));

    let subject: string;
    let heading: string;
    let message: string;
    let extraText: string[] = [];

    if (event === 'PREPARING') {
      subject = `Tu pedido #${number} está en preparación`;
      heading = 'Tu pedido está en preparación';
      message = 'Estamos preparando tu pedido. Te avisaremos por correo cuando esté en camino.';
    } else if (event === 'IN_TRANSIT') {
      subject = `Tu pedido #${number} está en camino`;
      heading = '¡Tu pedido está en camino!';
      message = 'Tu pedido ya está en tránsito hacia la dirección de entrega.';
      extraText = [
        `Entrega estimada: ${estimate}`,
        ...trackingRows,
        ...(trackingUrl ? [`Seguimiento del envío: ${trackingUrl}`] : []),
      ].filter((line): line is string => Boolean(line));
    } else {
      subject = `Actualización de entrega · Pedido #${number}`;
      heading = 'Se actualizó la entrega estimada';
      message = 'La fecha y hora estimadas de entrega de tu pedido fueron actualizadas.';
      extraText = [
        `Estimación anterior: ${oldEstimate ?? 'Sin estimación informada'}`,
        `Nueva entrega estimada: ${estimate}`,
        ...trackingRows,
        ...(trackingUrl ? [`Seguimiento del envío: ${trackingUrl}`] : []),
      ].filter((line): line is string => Boolean(line));
    }

    const linkHtml = trackingUrl
      ? `<p style="margin:20px 0"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none">Ver seguimiento del envío</a></p>`
      : '';
    const detailsHtml = extraText
      .map((line) => `<p style="margin:8px 0;color:#52525b;font-size:14px">${escapeHtml(line)}</p>`)
      .join('');
    const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f4f5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#18181b"><main style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:28px"><h1 style="font-size:24px;margin:0 0 16px">${escapeHtml(heading)}</h1><p>Hola ${escapeHtml(customerName)},</p><p>${escapeHtml(message)}</p><p style="font-size:16px">Número de pedido: <strong>#${number}</strong></p>${detailsHtml}${linkHtml}<p style="color:#71717a;font-size:13px;margin-top:28px">NOVA STORE · Conservá este correo como referencia de tu pedido.</p></main></body></html>`;
    const text = [
      heading,
      `Hola ${customerName},`,
      message,
      `Número de pedido: #${number}`,
      ...extraText,
      ...(trackingUrl ? [`Abrir seguimiento: ${trackingUrl}`] : []),
      '',
      'NOVA STORE',
    ].join('\n');

    const result = await sendBrevoEmail({
      to: notification.recipientEmail,
      toName: customerName,
      subject,
      html,
      text,
      idempotencyKey: createBrevoIdempotencyKey(`order-fulfillment:${notification.id}`),
    });

    await prisma.orderEmailNotification.update({
      where: { id: notification.id },
      data: {
        status: 'SENT',
        providerMessageId: result.messageId,
        sentAt: new Date(),
        lastError: null,
      },
    });
    ownsClaim = false;
    return true;
  } catch (error: unknown) {
    if (notificationId && ownsClaim) {
      await prisma.orderEmailNotification
        .update({
          where: { id: notificationId },
          data: {
            status: 'FAILED',
            lastError: (error instanceof Error
              ? error.message
              : 'Unknown email delivery error.'
            ).slice(0, 2000),
          },
        })
        .catch(() => null);
    }
    console.error('Order fulfillment email delivery failed.', {
      orderId,
      event,
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return false;
  }
}
