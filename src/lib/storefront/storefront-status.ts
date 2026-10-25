import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type StorefrontStatus = 'OPEN' | 'CLOSING' | 'CLOSED';

export class StorefrontClosedError extends Error {
  constructor() {
    super('STOREFRONT_CLOSED');
    this.name = 'StorefrontClosedError';
  }
}

/**
 * Missing subscription data means a new installation, so the store is open by
 * default. Any unexpected stored value fails closed rather than accepting sales.
 */
export async function getStorefrontStatus(): Promise<'OPEN' | 'CLOSED'> {
  const subscription = await prisma.storeSubscription.findUnique({
    where: { id: 'default' },
    select: { storefrontStatus: true },
  });

  if (!subscription || subscription.storefrontStatus === 'OPEN') return 'OPEN';
  return 'CLOSED';
}

/**
 * Serializes a new order against the OPEN -> CLOSING transition. Both this
 * conditional update and the closure action write the same subscription row;
 * therefore the closure cannot be confirmed while a new-order transaction is
 * still acquiring its place before the cutoff.
 */
export async function lockOpenStorefrontForNewOrder(
  db: Pick<Prisma.TransactionClient, 'storeSubscription'>,
): Promise<void> {
  const now = new Date();

  await db.storeSubscription.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      storefrontStatus: 'OPEN',
    },
    update: { updatedAt: now },
  });

  const claim = await db.storeSubscription.updateMany({
    where: { id: 'default', storefrontStatus: 'OPEN' },
    data: { updatedAt: new Date() },
  });

  if (claim.count !== 1) throw new StorefrontClosedError();
}
