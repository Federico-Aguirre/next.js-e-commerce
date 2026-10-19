import 'server-only';
import { createBrevoIdempotencyKey, sendBrevoEmail } from '@/lib/email/brevo';
import { prisma } from '@/lib/prisma';

const NOTIFICATION_TYPE = 'PURCHASE_CONFIRMATION';
const STALE_CLAIM_MS = 10 * 60 * 1000;

type ConfirmationEmailOrder = {
  id: string;
  status: string;
  orderNumber: number;
  total: number;
  currency: string;
  paymentTotal: number | null;
  paymentCurrency: string;
  paymentProvider: string | null;
  createdAt: Date;
  user: {
    email: string | null;
    firstName: string | null;
    name: string | null;
  };
  items: Array<{
    title: string;
    price: number;
    quantity: number;
    size: string;
  }>;
};

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

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function createConfirmationContent(order: ConfirmationEmailOrder) {
  const customerName = escapeHtml(order.user.firstName || order.user.name || 'cliente');
  const orderNumber = String(order.orderNumber);
  const total = formatMoney(order.total, order.currency);
  const paymentAmount =
    order.paymentTotal === null
      ? null
      : order.paymentCurrency !== order.currency ||
          Math.abs(order.paymentTotal - order.total) > 0.01
        ? formatMoney(order.paymentTotal, order.paymentCurrency)
        : null;
  const providerLabels: Record<string, string> = {
    MERCADOPAGO: 'Mercado Pago',
    STRIPE: 'Stripe',
    PAYPAL: 'PayPal',
  };
  const paymentMethod = escapeHtml(
    order.paymentProvider
      ? (providerLabels[order.paymentProvider] ?? order.paymentProvider)
      : 'medio de pago seleccionado',
  );
  const date = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(order.createdAt);

  const itemRows = order.items
    .map((item) => {
      const title = escapeHtml(item.title);
      const size = escapeHtml(item.size);
      const quantity = String(item.quantity);
      const lineTotal = formatMoney(item.price * item.quantity, order.currency);

      return `<tr>
        <td style="padding:10px;border-bottom:1px solid #e4e4e7">${title}<br><span style="color:#71717a;font-size:12px">Talle: ${size}</span></td>
        <td style="padding:10px;border-bottom:1px solid #e4e4e7;text-align:center">${quantity}</td>
        <td style="padding:10px;border-bottom:1px solid #e4e4e7;text-align:right;white-space:nowrap">${lineTotal}</td>
      </tr>`;
    })
    .join('');

  const textItems = order.items
    .map(
      (item) =>
        `- ${item.title} (talle ${item.size}) × ${item.quantity}: ${formatMoney(item.price * item.quantity, order.currency)}`,
    )
    .join('\n');

  return {
    subject: `Compra confirmada · Pedido #${orderNumber}`,
    html: `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f4f4f5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#18181b">
    <main style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:28px">
      <h1 style="font-size:24px;margin:0 0 16px">¡Gracias por tu compra!</h1>
      <p>Hola ${customerName}, confirmamos que tu pago fue registrado y tu pedido está confirmado.</p>
      <p style="font-size:16px">Número de pedido: <strong>#${orderNumber}</strong></p>
      <p style="color:#52525b;font-size:14px">Fecha: ${escapeHtml(date)}<br>Medio de pago: ${paymentMethod}</p>
      <h2 style="font-size:18px;margin-top:28px">Resumen de la compra</h2>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr>
          <th scope="col" style="padding:10px;border-bottom:2px solid #d4d4d8;text-align:left">Producto</th>
          <th scope="col" style="padding:10px;border-bottom:2px solid #d4d4d8;text-align:center">Cantidad</th>
          <th scope="col" style="padding:10px;border-bottom:2px solid #d4d4d8;text-align:right">Importe</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="font-size:18px;text-align:right;margin:24px 0"><strong>Total del pedido: ${total}</strong></p>
      ${paymentAmount ? `<p style="color:#52525b;font-size:14px;text-align:right">Importe enviado al medio de pago: <strong>${paymentAmount}</strong></p>` : ''}
      <p style="color:#52525b;font-size:14px;line-height:1.6">Conservá este correo como referencia. Podés consultar el estado de tu pedido desde el historial de compras de tu cuenta.</p>
      <p style="margin-top:28px">¡Gracias por elegirnos!</p>
    </main>
  </body>
</html>`,
    text: [
      '¡Gracias por tu compra!',
      `Hola ${order.user.firstName || order.user.name || 'cliente'}, confirmamos que tu pago fue registrado y tu pedido está confirmado.`,
      `Número de pedido: #${orderNumber}`,
      `Fecha: ${date}`,
      `Medio de pago: ${paymentMethod}`,
      '',
      'Resumen de la compra:',
      textItems,
      '',
      `Total del pedido: ${total}`,
      ...(paymentAmount ? [`Importe enviado al medio de pago: ${paymentAmount}`] : []),
      '',
      'Podés consultar el estado de tu pedido desde el historial de compras de tu cuenta.',
    ].join('\n'),
  };
}

/**
 * Sends the confirmation only after the order has a confirmed PAID status.
 * A persisted claim and Brevo's request idempotency key protect against duplicate callbacks.
 * A failed/stale attempt can be retried on a later payment-confirmation request.
 */
export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  let notificationId: string | undefined;
  let ownsClaim = false;

  try {
    const order = (await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, firstName: true, name: true } },
        items: { select: { title: true, price: true, quantity: true, size: true } },
      },
    })) as ConfirmationEmailOrder | null;

    if (!order || order.status !== 'PAID') return;

    const customerEmail = order.user.email?.trim().toLowerCase();
    if (!customerEmail) {
      console.error('Purchase confirmation email skipped: customer email is missing.', {
        orderId,
      });
      return;
    }

    const notification = await prisma.orderEmailNotification.upsert({
      where: {
        orderId_type: { orderId, type: NOTIFICATION_TYPE },
      },
      create: {
        orderId,
        type: NOTIFICATION_TYPE,
        recipientEmail: customerEmail,
        status: 'PENDING',
      },
      update: {},
    });
    notificationId = notification.id;

    if (notification.status === 'SENT') return;

    const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);
    const claim = await prisma.orderEmailNotification.updateMany({
      where: {
        id: notification.id,
        OR: [
          { status: { in: ['PENDING', 'FAILED'] } },
          { status: 'SENDING', updatedAt: { lt: staleBefore } },
        ],
      },
      data: {
        status: 'SENDING',
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    if (claim.count !== 1) return;
    ownsClaim = true;

    const content = createConfirmationContent(order);
    const result = await sendBrevoEmail({
      to: notification.recipientEmail,
      toName: order.user.firstName || order.user.name || undefined,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: createBrevoIdempotencyKey(`purchase-confirmation:${notification.id}`),
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown email delivery error.';

    if (notificationId && ownsClaim) {
      try {
        await prisma.orderEmailNotification.update({
          where: { id: notificationId },
          data: {
            status: 'FAILED',
            lastError: message.slice(0, 2000),
          },
        });
      } catch {
        console.error('Could not persist the failed purchase-confirmation email state.', {
          orderId,
        });
      }
    }

    console.error('Purchase confirmation email delivery failed.', {
      orderId,
      error: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}
