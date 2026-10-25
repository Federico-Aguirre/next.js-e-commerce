import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  subscriptionUpsert: vi.fn(),
  paymentFindUnique: vi.fn(),
  paymentCreate: vi.fn(),
  subscriptionUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    storeSubscription: { upsert: mocks.subscriptionUpsert },
    storeSubscriptionPayment: {
      findUnique: mocks.paymentFindUnique,
      create: mocks.paymentCreate,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  assertProPlanCanBePurchased,
  getProPlanPaidThrough,
  ProPlanBillingError,
} from './pro-plan-billing';

describe('Pro plan billing invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscriptionUpsert.mockResolvedValue({
      id: 'default',
      storefrontStatus: 'OPEN',
      planType: 'STANDARD',
      nextPaymentAt: null,
      pendingProPaymentId: null,
      pendingProPaymentProvider: null,
      pendingProPaymentExpiresAt: null,
      pendingProCheckoutSessionId: null,
      pendingProCheckoutExpiresAt: null,
    });
  });

  it('starts the first paid-through period at the next Argentina calendar-month boundary', () => {
    expect(
      getProPlanPaidThrough('STANDARD', null, new Date('2026-10-25T12:00:00.000Z')).toISOString(),
    ).toBe('2026-11-01T03:00:00.000Z');
  });

  it('extends a still-active Pro period instead of resetting it from the current date', () => {
    expect(
      getProPlanPaidThrough(
        'PRO',
        new Date('2026-11-01T03:00:00.000Z'),
        new Date('2026-10-25T12:00:00.000Z'),
      ).toISOString(),
    ).toBe('2026-12-01T03:00:00.000Z');
  });

  it('starts a new month from the current time when a previous Pro period has expired', () => {
    expect(
      getProPlanPaidThrough(
        'PRO',
        new Date('2026-10-01T03:00:00.000Z'),
        new Date('2026-10-25T12:00:00.000Z'),
      ).toISOString(),
    ).toBe('2026-11-01T03:00:00.000Z');
  });

  it('rejects plan payments while the storefront is closed', async () => {
    mocks.subscriptionUpsert.mockResolvedValueOnce({
      id: 'default',
      storefrontStatus: 'CLOSED',
      planType: 'STANDARD',
      nextPaymentAt: null,
      pendingProPaymentId: null,
      pendingProPaymentProvider: null,
      pendingProPaymentExpiresAt: null,
      pendingProCheckoutSessionId: null,
      pendingProCheckoutExpiresAt: null,
    });
    await expect(assertProPlanCanBePurchased()).rejects.toMatchObject({
      code: 'STOREFRONT_CLOSED',
    } satisfies Partial<ProPlanBillingError>);
  });

  it('blocks a second subscription payment while a previous provider payment is pending', async () => {
    mocks.subscriptionUpsert.mockResolvedValueOnce({
      id: 'default',
      storefrontStatus: 'OPEN',
      planType: 'STANDARD',
      nextPaymentAt: null,
      pendingProPaymentId: 'pi_test_pending',
      pendingProPaymentProvider: 'STRIPE',
      pendingProPaymentExpiresAt: new Date(Date.now() + 60_000),
      pendingProCheckoutSessionId: null,
      pendingProCheckoutExpiresAt: null,
    });
    await expect(assertProPlanCanBePurchased()).rejects.toMatchObject({
      code: 'PRO_PAYMENT_PENDING',
    } satisfies Partial<ProPlanBillingError>);
  });
});
