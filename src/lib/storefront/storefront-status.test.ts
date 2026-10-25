import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    storeSubscription: {
      findUnique: mocks.findUnique,
    },
  },
}));

import {
  getStorefrontStatus,
  lockOpenStorefrontForNewOrder,
  StorefrontClosedError,
} from './storefront-status';

describe('storefront availability and new-order lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({ storefrontStatus: 'OPEN' });
    mocks.upsert.mockResolvedValue({ id: 'default', storefrontStatus: 'OPEN' });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it('defaults to OPEN when no subscription row exists', async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(getStorefrontStatus()).resolves.toBe('OPEN');
  });

  it.each(['CLOSING', 'CLOSED', 'unexpected'])(
    'treats status %s as closed to new sales',
    async (storefrontStatus) => {
      mocks.findUnique.mockResolvedValue({ storefrontStatus });
      await expect(getStorefrontStatus()).resolves.toBe('CLOSED');
    },
  );

  it('locks the open subscription row before any stock reservation can begin', async () => {
    const tx = {
      storeSubscription: {
        upsert: mocks.upsert,
        updateMany: mocks.updateMany,
      },
    };

    await expect(lockOpenStorefrontForNewOrder(tx as never)).resolves.toBeUndefined();

    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: { id: 'default', storefrontStatus: 'OPEN' },
      update: { updatedAt: expect.any(Date) },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'default', storefrontStatus: 'OPEN' },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('rejects a new-order transaction when closure already won the lock', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const tx = {
      storeSubscription: {
        upsert: mocks.upsert,
        updateMany: mocks.updateMany,
      },
    };

    await expect(lockOpenStorefrontForNewOrder(tx as never)).rejects.toBeInstanceOf(
      StorefrontClosedError,
    );
  });
});
