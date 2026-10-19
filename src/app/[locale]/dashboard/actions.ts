'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sendLowStockAlerts } from '@/lib/order-alerts';
import { fromBuenosAiresDateTimeLocal, sameDeliveryMinute } from '@/lib/orders/delivery-estimate';
import { sendOrderFulfillmentEmail } from '@/lib/orders/order-fulfillment-email';
import { prisma } from '@/lib/prisma';
import {
  createOrderShipping,
  quoteOrderShipping,
  refreshOrderShipping,
} from '@/lib/shipping/order-shipping';
import type { ShippingQuote } from '@/lib/shipping/types';
import { requireDashboardAdmin } from './data';

const fulfillmentStatuses = ['PENDING', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
const fulfillmentStatusSchema = z.enum(fulfillmentStatuses);

const allowedTransitions: Record<(typeof fulfillmentStatuses)[number], readonly string[]> = {
  PENDING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

function dashboardPath(locale: string) {
  return `/${locale}/dashboard`;
}

export async function updateOrder(formData: FormData) {
  await requireDashboardAdmin();

  const input = {
    orderId: String(formData.get('orderId') ?? ''),
    fulfillmentStatus: String(formData.get('fulfillmentStatus') ?? ''),
    trackingCode: String(formData.get('trackingCode') ?? '').trim(),
    estimatedDeliveryAtInput: String(formData.get('estimatedDeliveryAt') ?? '').trim(),
    locale: String(formData.get('locale') ?? 'es'),
  };

  const parsed = z
    .object({
      orderId: z.string().min(1),
      fulfillmentStatus: fulfillmentStatusSchema,
      trackingCode: z.string().max(100),
      estimatedDeliveryAtInput: z
        .string()
        .refine(
          (value) => value === '' || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),
          'Invalid date and time',
        )
        .transform((value) => (value === '' ? null : value)),
      locale: z.string().min(2).max(5),
    })
    .safeParse(input);

  if (!parsed.success) return { success: false };

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    select: {
      fulfillmentStatus: true,
      deliveredAt: true,
      shippingProvider: true,
      shippingStatus: true,
      estimatedDeliveryAt: true,
    },
  });

  if (!order) return { success: false };

  const current = fulfillmentStatusSchema
    .catch('PENDING')
    .parse(order.fulfillmentStatus || 'PENDING');
  const next = parsed.data.fulfillmentStatus;
  const isReadyForLocalPickup =
    order.shippingProvider === 'LOCAL' && order.shippingStatus === 'READY_FOR_PICKUP';
  const isLocalPickupCompletion =
    current === 'PREPARING' && next === 'DELIVERED' && isReadyForLocalPickup;

  if (current !== next && !allowedTransitions[current].includes(next) && !isLocalPickupCompletion) {
    return { success: false };
  }

  const estimatedDeliveryAt = parsed.data.estimatedDeliveryAtInput
    ? fromBuenosAiresDateTimeLocal(parsed.data.estimatedDeliveryAtInput)
    : null;

  if (parsed.data.estimatedDeliveryAtInput && !estimatedDeliveryAt) {
    return { success: false as const, errorCode: 'ETA_INVALID' };
  }
  if (next === 'SHIPPED' && !estimatedDeliveryAt) {
    return { success: false as const, errorCode: 'ETA_REQUIRED' };
  }
  if (next === 'SHIPPED' && estimatedDeliveryAt && estimatedDeliveryAt.getTime() <= Date.now()) {
    return { success: false as const, errorCode: 'ETA_MUST_BE_FUTURE' };
  }

  const etaChanged = !sameDeliveryMinute(order.estimatedDeliveryAt, estimatedDeliveryAt);
  const updatedOrder = await prisma.order.update({
    where: { id: parsed.data.orderId },
    data: {
      fulfillmentStatus: next,
      trackingCode: parsed.data.trackingCode || null,
      estimatedDeliveryAt,
      ...(next === 'DELIVERED' && current !== 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      ...(isLocalPickupCompletion ? { shippingStatus: 'PICKED_UP' } : {}),
    },
    select: { updatedAt: true, estimatedDeliveryAt: true, fulfillmentStatus: true },
  });

  let emailSent: boolean | undefined;
  if (current !== next && next === 'PREPARING') {
    emailSent = await sendOrderFulfillmentEmail(parsed.data.orderId, 'PREPARING');
  } else if (current !== next && next === 'SHIPPED') {
    emailSent = await sendOrderFulfillmentEmail(parsed.data.orderId, 'IN_TRANSIT');
  } else if (current === 'SHIPPED' && next === 'SHIPPED' && etaChanged) {
    emailSent = await sendOrderFulfillmentEmail(parsed.data.orderId, 'DELIVERY_ESTIMATE_UPDATED', {
      eventVersion: updatedOrder.updatedAt.getTime(),
      previousEstimatedDeliveryAt: order.estimatedDeliveryAt,
    });
  }

  revalidatePath(dashboardPath(parsed.data.locale));
  return emailSent === undefined
    ? { success: true as const }
    : { success: true as const, emailSent };
}

export async function quoteShipment(formData: FormData) {
  await requireDashboardAdmin();
  const orderId = String(formData.get('orderId') ?? '').trim();
  if (!orderId) return { success: false as const, error: 'Pedido inválido.' };
  return quoteOrderShipping(orderId);
}

export async function createShipment(formData: FormData) {
  await requireDashboardAdmin();
  const orderId = String(formData.get('orderId') ?? '').trim();
  const rawQuote = String(formData.get('quote') ?? '');
  if (!orderId || !rawQuote) return { success: false as const, error: 'Falta la cotización.' };

  let quote: ShippingQuote;
  try {
    quote = JSON.parse(rawQuote) as ShippingQuote;
  } catch {
    return { success: false as const, error: 'Cotización inválida.' };
  }
  if (quote.provider !== 'ZIPNOVA' && quote.provider !== 'SHIPPO' && quote.provider !== 'LOCAL') {
    return { success: false as const, error: 'Proveedor inválido.' };
  }

  const result = await createOrderShipping(orderId, quote);
  revalidatePath(dashboardPath(String(formData.get('locale') ?? 'es')));
  return result;
}

export async function refreshShipment(formData: FormData) {
  await requireDashboardAdmin();
  const orderId = String(formData.get('orderId') ?? '').trim();
  if (!orderId) return { success: false as const, error: 'Pedido inválido.' };
  const result = await refreshOrderShipping(orderId);
  revalidatePath(dashboardPath(String(formData.get('locale') ?? 'es')));
  return result;
}

export async function updateCatalog(formData: FormData) {
  await requireDashboardAdmin();

  const locale = String(formData.get('locale') ?? 'es');
  const threshold = Number(formData.get('threshold'));
  const alertsEnabled = String(formData.get('alertsEnabled') ?? 'false') === 'true';
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100_000) {
    return { success: false as const, sent: 0, configured: true };
  }

  let rawUpdates: unknown;
  try {
    rawUpdates = JSON.parse(String(formData.get('updates') ?? '[]'));
  } catch {
    return { success: false as const, sent: 0, configured: true };
  }

  const parsed = z
    .array(
      z.object({
        productId: z.number().int().positive(),
        skuId: z.string().min(1),
        price: z.number().finite().min(0).max(1_000_000),
        stock: z.number().int().min(0).max(100_000),
        isActive: z.boolean(),
      }),
    )
    .min(1)
    .max(500)
    .safeParse(rawUpdates);

  if (!parsed.success || !/^\w{2}(?:-\w{2})?$/.test(locale)) {
    return { success: false as const, sent: 0, configured: true };
  }

  const skuIds = parsed.data.map((item) => item.skuId);
  if (new Set(skuIds).size !== skuIds.length)
    return { success: false as const, sent: 0, configured: true };

  const databaseSkus = await prisma.productSku.findMany({
    where: { id: { in: skuIds } },
    select: { id: true, variant: { select: { productId: true } } },
  });
  const skuProduct = new Map(databaseSkus.map((sku) => [sku.id, sku.variant.productId]));
  if (databaseSkus.length !== parsed.data.length)
    return { success: false as const, sent: 0, configured: true };

  const productChanges = new Map<number, { price: number; isActive: boolean }>();
  for (const item of parsed.data) {
    if (skuProduct.get(item.skuId) !== item.productId)
      return { success: false as const, sent: 0, configured: true };

    const existing = productChanges.get(item.productId);
    if (existing && (existing.price !== item.price || existing.isActive !== item.isActive)) {
      return { success: false as const, sent: 0, configured: true };
    }
    productChanges.set(item.productId, { price: item.price, isActive: item.isActive });
  }

  await prisma.$transaction(async (tx) => {
    for (const [productId, change] of productChanges) {
      await tx.product.update({ where: { id: productId }, data: change });
    }

    for (const item of parsed.data) {
      await tx.productSku.update({ where: { id: item.skuId }, data: { stock: item.stock } });
    }

    await tx.inventoryAlertSettings.upsert({
      where: { id: 'default' },
      update: { enabled: alertsEnabled, threshold },
      create: { id: 'default', enabled: alertsEnabled, threshold },
    });

    await tx.productSku.updateMany({
      where: { stock: { gt: threshold }, lowStockAlertSent: true },
      data: { lowStockAlertSent: false, lowStockAlertedAt: null },
    });
  });

  const alertResult = await sendLowStockAlerts();

  revalidatePath(dashboardPath(locale));
  revalidatePath('/[locale]/products', 'page');
  revalidatePath('/[locale]/products/[slug]', 'page');
  revalidatePath('/product/[id]', 'page');
  revalidatePath('/[locale]', 'page');
  return { success: true as const, sent: alertResult.sent, configured: alertResult.configured };
}
