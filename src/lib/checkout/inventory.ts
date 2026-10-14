import type { Prisma } from '@prisma/client';

export type CheckoutInventoryItem = {
  id?: string | number;
  productId?: string | number;
  articleId?: string | number;
  variantId?: string;
  colorName?: string;
  title: string;
  quantity: number;
  image?: string;
  size: string;
};

function asPositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeColor(value: string | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replaceAll('grey', 'gray')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export async function resolveCartSku(tx: Prisma.TransactionClient, item: CheckoutInventoryItem) {
  const requestedProductId = asPositiveInt(item.productId ?? item.id);
  const articleId = asPositiveInt(item.articleId);
  const size = String(item.size ?? '').trim();

  if (!size) {
    return null;
  }

  const include = {
    variant: {
      include: {
        product: true,
      },
    },
  } as const;

  // articleId identifica un SKU de forma global. Lo validamos primero y sólo lo
  // aceptamos si también coincide el producto visible del carrito. Así un carrito
  // viejo nunca puede convertir un articleId obsoleto en otro producto.
  if (articleId) {
    const directSku = await tx.productSku.findUnique({
      where: { articleId },
      include,
    });
    const titleMatches =
      !item.title ||
      directSku?.variant.product.name.localeCompare(item.title, undefined, {
        sensitivity: 'accent',
      }) === 0;

    if (directSku && directSku.size === size && titleMatches) {
      return directSku;
    }
  }

  let productId = requestedProductId;

  if (productId) {
    const productExists = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!productExists) productId = null;
  }

  if (!productId && item.title) {
    const productByName = await tx.product.findFirst({
      where: {
        name: { equals: item.title, mode: 'insensitive' },
      },
      select: { id: true },
    });
    productId = productByName?.id ?? null;
  }

  if (!productId) {
    return null;
  }

  if (item.variantId) {
    const byVariant = await tx.productSku.findFirst({
      where: {
        variantId: item.variantId,
        size,
        variant: { productId },
      },
      include,
    });

    if (byVariant) {
      return byVariant;
    }
  }

  if (articleId) {
    const byArticle = await tx.productSku.findFirst({
      where: {
        articleId,
        size,
        variant: { productId },
      },
      include,
    });

    if (byArticle) {
      return byArticle;
    }
  }

  const candidates = await tx.productSku.findMany({
    where: {
      size,
      variant: { productId },
    },
    include,
  });

  if (candidates.length === 1) {
    return candidates[0]!;
  }

  const requestedColor = normalizeColor(item.colorName);
  if (requestedColor) {
    const colorMatches = candidates.filter((candidate) => {
      const databaseColor = normalizeColor(candidate.variant.colorName);
      return (
        databaseColor === requestedColor ||
        databaseColor.includes(requestedColor) ||
        requestedColor.includes(databaseColor)
      );
    });

    if (colorMatches.length === 1) {
      return colorMatches[0]!;
    }
  }

  return null;
}

export async function restoreOrderStock(
  tx: Prisma.TransactionClient,
  items: ReadonlyArray<{ productId: string; size: string; quantity: number }>,
) {
  const settings = await tx.inventoryAlertSettings.findUnique({ where: { id: 'default' } });
  const threshold = settings?.threshold ?? 5;

  for (const item of items) {
    const articleId = asPositiveInt(item.productId);
    if (!articleId) continue;

    await tx.productSku.updateMany({
      where: {
        articleId,
        size: item.size,
      },
      data: {
        stock: { increment: item.quantity },
      },
    });

    // Si una reserva fallida/cancelada devuelve el stock por encima del umbral,
    // el SKU queda listo para volver a alertar en una caída futura.
    await tx.productSku.updateMany({
      where: {
        articleId,
        size: item.size,
        stock: { gt: threshold },
        lowStockAlertSent: true,
      },
      data: { lowStockAlertSent: false, lowStockAlertedAt: null },
    });
  }
}
