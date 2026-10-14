'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sendLowStockAlerts } from '@/lib/order-alerts';
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
    estimatedDeliveryHours: String(formData.get('estimatedDeliveryHours') ?? '').trim(),
    locale: String(formData.get('locale') ?? 'es'),
  };

  const parsed = z
    .object({
      orderId: z.string().min(1),
      fulfillmentStatus: fulfillmentStatusSchema,
      trackingCode: z.string().max(100),
      estimatedDeliveryHours: z
        .string()
        .refine((value) => value === '' || /^\\d+$/.test(value), 'Invalid hours')
        .transform((value) => (value === '' ? null : Number(value)))
        .refine((value) => value === null || (value >= 0 && value <= 720), 'Invalid hours'),
      locale: z.string().min(2).max(5),
    })
    .safeParse(input);

  if (!parsed.success) return { success: false };

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    select: { fulfillmentStatus: true, deliveredAt: true },
  });

  if (!order) return { success: false };

  const current = fulfillmentStatusSchema
    .catch('PENDING')
    .parse(order.fulfillmentStatus || 'PENDING');
  const next = parsed.data.fulfillmentStatus;
  if (current !== next && !allowedTransitions[current].includes(next)) {
    return { success: false };
  }

  const estimatedDeliveryAt =
    parsed.data.estimatedDeliveryHours === null
      ? null
      : new Date(Date.now() + parsed.data.estimatedDeliveryHours * 60 * 60 * 1000);

  await prisma.order.update({
    where: { id: parsed.data.orderId },
    data: {
      fulfillmentStatus: next,
      trackingCode: parsed.data.trackingCode || null,
      estimatedDeliveryAt,
      ...(next === 'DELIVERED' && current !== 'DELIVERED' ? { deliveredAt: new Date() } : {}),
    },
  });

  revalidatePath(dashboardPath(parsed.data.locale));
  return { success: true };
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
