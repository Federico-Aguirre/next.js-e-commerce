import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  subscriptionUpsert: vi.fn(),
  subscriptionUpdateMany: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  expireCheckout: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    storeSubscription: {
      upsert: mocks.subscriptionUpsert,
      updateMany: mocks.subscriptionUpdateMany,
      findUnique: mocks.subscriptionFindUnique,
    },
  },
}));
vi.mock('./data', () => ({ requireDashboardAdmin: mocks.requireAdmin }));
vi.mock('@/lib/payments/pro-plan-checkout', () => ({
  expirePendingProCheckout: mocks.expireCheckout,
}));

import { closeStorefront, reopenStorefront } from './storefront-actions';

describe('storefront lifecycle actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mocks.subscriptionUpsert.mockResolvedValue({
      id: 'default',
      storefrontStatus: 'OPEN',
      pendingProCheckoutSessionId: null,
    });
    mocks.subscriptionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.subscriptionFindUnique.mockResolvedValue({
      storefrontStatus: 'OPEN',
      pendingProCheckoutSessionId: null,
    });
    mocks.expireCheckout.mockResolvedValue(undefined);
  });

  it('closes the public storefront while retaining orders and plan/recovery data', async () => {
    const result = await closeStorefront();
    expect(result).toEqual({ ok: true, status: 'CLOSED' });
    expect(mocks.subscriptionUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'default', storefrontStatus: 'OPEN', pendingProPaymentId: null },
      data: { storefrontStatus: 'CLOSING' },
    });
    expect(mocks.subscriptionUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'default', storefrontStatus: 'CLOSING' },
      data: expect.objectContaining({
        storefrontStatus: 'CLOSED',
        storefrontClosedAt: expect.any(Date),
        pendingProCheckoutSessionId: null,
        pendingProCheckoutExpiresAt: null,
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout');
    const data = mocks.subscriptionUpdateMany.mock.calls[1][0].data;
    expect(data).not.toHaveProperty('planType');
    expect(data).not.toHaveProperty('nextPaymentAt');
    expect(data).not.toHaveProperty('customizationRecoveryActive');
  });

  it('keeps the storefront open while a direct Pro payment is unresolved', async () => {
    mocks.subscriptionUpdateMany.mockResolvedValueOnce({ count: 0 });
    mocks.subscriptionFindUnique.mockResolvedValueOnce({
      storefrontStatus: 'OPEN',
      pendingProPaymentId: 'pi_test_pending',
    });
    const result = await closeStorefront();
    expect(result).toEqual({ ok: false, code: 'PRO_PAYMENT_PENDING' });
    expect(mocks.subscriptionUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.subscriptionUpdateMany).toHaveBeenCalledWith({
      where: { id: 'default', storefrontStatus: 'OPEN', pendingProPaymentId: null },
      data: { storefrontStatus: 'CLOSING' },
    });
  });

  it('expires a pending Pro checkout before confirming the closure', async () => {
    mocks.subscriptionFindUnique.mockResolvedValueOnce({
      pendingProCheckoutSessionId: 'cs_test_pending',
    });
    const result = await closeStorefront();
    expect(mocks.expireCheckout).toHaveBeenCalledWith('cs_test_pending');
    expect(result).toEqual({ ok: true, status: 'CLOSED' });
  });

  it('restores OPEN status when a pending Pro checkout cannot be cancelled', async () => {
    mocks.subscriptionFindUnique.mockResolvedValueOnce({
      pendingProCheckoutSessionId: 'cs_test_pending',
    });
    mocks.expireCheckout.mockRejectedValue(new Error('STRIPE_UNAVAILABLE'));
    const result = await closeStorefront();
    expect(result).toEqual({ ok: false, code: 'PLAN_CHECKOUT_CANCEL_FAILED' });
    expect(mocks.subscriptionUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'default', storefrontStatus: 'CLOSING' },
      data: { storefrontStatus: 'OPEN' },
    });
    expect(mocks.subscriptionUpdateMany).toHaveBeenCalledTimes(2);
  });

  it('does not prevent closure when Stripe confirms the plan checkout was already paid', async () => {
    mocks.subscriptionFindUnique.mockResolvedValueOnce({
      pendingProCheckoutSessionId: 'cs_test_paid',
    });
    mocks.expireCheckout.mockRejectedValue(new Error('PRO_CHECKOUT_ALREADY_PAID'));
    const result = await closeStorefront();
    expect(result).toEqual({ ok: true, status: 'CLOSED' });
  });

  it('does not run a second simultaneous closure while one is in progress', async () => {
    mocks.subscriptionUpdateMany.mockResolvedValueOnce({ count: 0 });
    mocks.subscriptionFindUnique.mockResolvedValueOnce({ storefrontStatus: 'CLOSING' });
    const result = await closeStorefront();
    expect(result).toEqual({ ok: false, code: 'CLOSURE_IN_PROGRESS' });
  });

  it('reopens a closed storefront without deleting or resetting the subscription record', async () => {
    const result = await reopenStorefront();
    expect(result).toEqual({ ok: true, status: 'OPEN' });
    expect(mocks.subscriptionUpdateMany).toHaveBeenCalledWith({
      where: { id: 'default', storefrontStatus: 'CLOSED' },
      data: { storefrontStatus: 'OPEN' },
    });
  });
});
