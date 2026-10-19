import { Env } from '@/lib/Env';
import { prisma } from '@/lib/prisma';

const ALERT_INTERVAL_MINUTES = 30;
const TELEGRAM_API_BASE = Env.TELEGRAM_BOT_TOKEN
  ? `https://api.telegram.org/bot${Env.TELEGRAM_BOT_TOKEN}`
  : null;

async function sendTelegramMessage(content: string) {
  if (!TELEGRAM_API_BASE || !Env.TELEGRAM_CHAT_ID) {
    return false;
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: Env.TELEGRAM_CHAT_ID,
      text: content,
      disable_web_page_preview: true,
    }),
    cache: 'no-store',
  });

  const result = (await response.json()) as {
    ok?: boolean;
    description?: string;
  };

  if (!response.ok || !result.ok) {
    throw new Error(`Telegram message failed: ${result.description ?? response.status}`);
  }

  return true;
}

function formatOrderAlert(order: {
  id: string;
  orderNumber: number;
  total: number;
  currency: string;
  fulfillmentStatus: string;
  estimatedDeliveryAt: Date;
}) {
  const estimatedDelivery = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(order.estimatedDeliveryAt);

  return [
    '⚠️ Alerta de entrega',
    `Pedido: #${String(order.orderNumber).padStart(6, '0')}`,
    `Total: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: order.currency, currencyDisplay: 'code' }).format(order.total)}`,
    `Estado: ${order.fulfillmentStatus}`,
    `Entrega estimada: ${estimatedDelivery}`,
    'Ya pasó el tiempo estimado de entrega y el pedido sigue pendiente de finalización.',
  ].join('\\n');
}

export async function sendPaidOrderAlert(orderId: string) {
  if (!Env.TELEGRAM_BOT_TOKEN || !Env.TELEGRAM_CHAT_ID) {
    return false;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      currency: true,
      createdAt: true,
      fulfillmentStatus: true,
      status: true,
    },
  });

  if (!order || order.status !== 'PAID') {
    return false;
  }

  try {
    const delivered = await sendTelegramMessage(
      [
        '🛍️ Nuevo pedido pagado',
        'Pedido: #' + String(order.orderNumber).padStart(6, '0'),
        'Total: ' +
          new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: order.currency,
            currencyDisplay: 'code',
          }).format(order.total),
        'Estado: ' + order.fulfillmentStatus,
        'El pago fue confirmado correctamente.',
      ].join('\\n'),
    );

    if (delivered) {
      await prisma.order.update({
        where: { id: order.id },
        data: { lastDeliveryAlertAt: order.createdAt },
      });
    }

    return delivered;
  } catch (error) {
    console.error('[ORDER ALERT] Telegram new-order notification failed:', error);
    return false;
  }
}

export async function sendLowStockAlerts() {
  const settings = await prisma.inventoryAlertSettings.findUnique({ where: { id: 'default' } });
  const threshold = settings?.threshold ?? 5;

  // Rearmamos un SKU sólo después de que realmente se recuperó por encima del umbral.
  await prisma.productSku.updateMany({
    where: { lowStockAlertSent: true, stock: { gt: threshold } },
    data: { lowStockAlertSent: false, lowStockAlertedAt: null },
  });

  if (!settings?.enabled) {
    return {
      sent: 0,
      enabled: false,
      configured: Boolean(TELEGRAM_API_BASE && Env.TELEGRAM_CHAT_ID),
    };
  }

  const lowStockSkus = await prisma.productSku.findMany({
    where: {
      stock: { lte: threshold },
      lowStockAlertSent: false,
    },
    orderBy: [{ variant: { product: { name: 'asc' } } }, { articleId: 'asc' }],
    take: 20,
    select: {
      id: true,
      articleId: true,
      size: true,
      stock: true,
      variant: {
        select: {
          colorName: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  if (lowStockSkus.length === 0) {
    return {
      sent: 0,
      enabled: true,
      configured: Boolean(TELEGRAM_API_BASE && Env.TELEGRAM_CHAT_ID),
    };
  }

  if (!TELEGRAM_API_BASE || !Env.TELEGRAM_CHAT_ID) {
    return { sent: 0, enabled: true, configured: false };
  }

  const content = [
    `⚠️ Alerta de stock bajo (umbral: ${threshold})`,
    ...lowStockSkus.map(
      (sku) =>
        `• ${sku.variant.product.name} · ${sku.variant.colorName} · talle ${sku.size} · SKU ${sku.articleId}: ${sku.stock} unidades`,
    ),
    'No se volverá a avisar por estos SKU hasta que el stock supere el umbral y vuelva a bajar.',
  ].join('\\n');

  try {
    const delivered = await sendTelegramMessage(content);
    if (!delivered) return { sent: 0, enabled: true, configured: true };

    const now = new Date();
    await prisma.productSku.updateMany({
      where: { id: { in: lowStockSkus.map((sku) => sku.id) } },
      data: { lowStockAlertSent: true, lowStockAlertedAt: now },
    });

    return { sent: lowStockSkus.length, enabled: true, configured: true };
  } catch (error) {
    console.error('[STOCK ALERT] Telegram notification failed:', error);
    return { sent: 0, enabled: true, configured: true };
  }
}

export async function sendOverdueOrderAlerts() {
  if (!Env.TELEGRAM_BOT_TOKEN || !Env.TELEGRAM_CHAT_ID) {
    return { sent: 0, skipped: 0 };
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - ALERT_INTERVAL_MINUTES * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: 'PAID',
      fulfillmentStatus: { in: ['PENDING', 'PREPARING'] },
      estimatedDeliveryAt: { lt: now },
      OR: [{ lastDeliveryAlertAt: null }, { lastDeliveryAlertAt: { lte: cutoff } }],
    },
    orderBy: { estimatedDeliveryAt: 'asc' },
    take: 20,
    select: {
      id: true,
      orderNumber: true,
      total: true,
      currency: true,
      fulfillmentStatus: true,
      estimatedDeliveryAt: true,
    },
  });

  if (!Env.TELEGRAM_BOT_TOKEN || !Env.TELEGRAM_CHAT_ID || orders.length === 0) {
    return { sent: 0, skipped: orders.length };
  }

  let sent = 0;
  for (const order of orders) {
    if (!order.estimatedDeliveryAt) continue;

    try {
      const delivered = await sendTelegramMessage(
        formatOrderAlert({
          ...order,
          estimatedDeliveryAt: order.estimatedDeliveryAt,
        }),
      );

      if (delivered) {
        await prisma.order.update({
          where: { id: order.id },
          data: { lastDeliveryAlertAt: now },
        });
        sent += 1;
      }
    } catch (error) {
      console.error('[ORDER ALERT] Telegram notification failed:', error);
    }
  }

  return { sent, skipped: orders.length - sent };
}
