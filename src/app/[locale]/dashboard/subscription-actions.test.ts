import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  subscriptionUpsert: vi.fn(),
  subscriptionUpdate: vi.fn(),
  createCheckout: vi.fn(),
  expireCheckout: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    storeSubscription: { upsert: mocks.subscriptionUpsert, update: mocks.subscriptionUpdate },
  },
}));
vi.mock('./data', () => ({ requireDashboardAdmin: mocks.requireAdmin }));
vi.mock('@/lib/payments/pro-plan-checkout', () => ({
  createProPlanCheckoutSession: mocks.createCheckout,
  expirePendingProCheckout: mocks.expireCheckout,
}));

import { startProPlanCheckout, switchToStandardPlan } from './subscription-actions';

const admin = { user: { id: 'admin-123', email: 'owner@example.test' } };
const recoveryStartedAt = new Date('2026-10-20T12:00:00.000Z');

function form(locale = 'es') {
  const value = new FormData();
  value.set('locale', locale);
  return value;
}

describe('admin subscription plan actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(admin);
    mocks.subscriptionUpsert.mockResolvedValue({
      id: 'default',
      status: 'ACTIVE',
      storefrontStatus: 'OPEN',
      planType: 'PRO',
      commissionPercent: 2,
      customizationRecoveryActive: true,
      setupRecoveryStartedAt: recoveryStartedAt,
      setupRecoveryTarget: 200_000,
      monthlyPriceARS: 75_000,
      pendingProCheckoutSessionId: null,
      pendingProCheckoutExpiresAt: null,
    });
    mocks.subscriptionUpdate.mockResolvedValue({});
    mocks.createCheckout.mockResolvedValue({
      ok: true,
      url: 'https://checkout.stripe.com/session',
      reused: false,
    });
    mocks.expireCheckout.mockResolvedValue(undefined);
  });

  it('starts Pro checkout for the authenticated administrator without changing the plan early', async () => {
    const result = await startProPlanCheckout(form('es'));
    expect(result).toEqual({ ok: true, url: 'https://checkout.stripe.com/session', reused: false });
    expect(mocks.createCheckout).toHaveBeenCalledWith({
      adminUserId: 'admin-123',
      email: 'owner@example.test',
      locale: 'es',
    });
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
  });

  it('switches to Standard without clearing the active customization recovery cycle', async () => {
    const result = await switchToStandardPlan(form('en'));
    expect(result).toEqual({ ok: true });
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: expect.objectContaining({
        status: 'ACTIVE',
        planType: 'STANDARD',
        commissionPercent: 8,
        nextPaymentAt: null,
        pendingProCheckoutSessionId: null,
        pendingProCheckoutExpiresAt: null,
      }),
    });
    const update = mocks.subscriptionUpdate.mock.calls[0][0].data;
    expect(update).not.toHaveProperty('customizationRecoveryActive');
    expect(update).not.toHaveProperty('setupRecoveryStartedAt');
    expect(update).not.toHaveProperty('setupRecoveryTarget');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/developer');
  });

  it('does not switch away while a checkout already has a completed payment', async () => {
    mocks.subscriptionUpsert.mockResolvedValueOnce({
      id: 'default',
      storefrontStatus: 'OPEN',
      pendingProCheckoutSessionId: 'cs_test_paid',
      customizationRecoveryActive: true,
      setupRecoveryStartedAt: recoveryStartedAt,
    });
    mocks.expireCheckout.mockRejectedValue(new Error('PRO_CHECKOUT_ALREADY_PAID'));
    const result = await switchToStandardPlan(form('es'));
    expect(result).toEqual({ ok: false, code: 'PAYMENT_ALREADY_COMPLETED' });
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
  });
});
