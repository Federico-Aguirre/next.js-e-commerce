import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stripeCreate: vi.fn(),
  stripeRetrieve: vi.fn(),
  stripeExpire: vi.fn(),
  subscriptionUpsert: vi.fn(),
  subscriptionUpdate: vi.fn(),
  subscriptionUpdateMany: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  paymentFindUnique: vi.fn(),
  txSubscriptionUpsert: vi.fn(),
  txSubscriptionUpdate: vi.fn(),
  txPaymentFindUnique: vi.fn(),
  txPaymentCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    storeSubscription: {
      upsert: mocks.subscriptionUpsert,
      update: mocks.subscriptionUpdate,
      updateMany: mocks.subscriptionUpdateMany,
      findUnique: mocks.subscriptionFindUnique,
    },
    storeSubscriptionPayment: { findUnique: mocks.paymentFindUnique },
    $transaction: mocks.transaction,
  },
}));
vi.mock('stripe', () => ({
  default: class StripeMock {
    checkout = {
      sessions: {
        create: mocks.stripeCreate,
        retrieve: mocks.stripeRetrieve,
        expire: mocks.stripeExpire,
      },
    };
  },
}));

import {
  completeProPlanCheckout,
  createProPlanCheckoutSession,
  PRO_CHECKOUT_AMOUNT_ARS,
} from './pro-plan-checkout';

const adminUserId = 'admin-user-1';
const subscription = {
  id: 'default',
  status: 'ACTIVE',
  storefrontStatus: 'OPEN',
  planType: 'STANDARD',
  commissionPercent: 8,
  nextPaymentAt: null,
  pendingProCheckoutSessionId: null,
  pendingProCheckoutExpiresAt: null,
  updatedAt: new Date('2026-10-23T12:00:00.000Z'),
  customizationRecoveryActive: true,
  setupRecoveryTarget: 200_000,
  setupRecoveryStartedAt: new Date('2026-10-20T12:00:00.000Z'),
  monthlyPriceARS: 75_000,
};

const paidSession = {
  id: 'cs_test_paid_1',
  status: 'complete',
  payment_status: 'paid',
  mode: 'payment',
  livemode: false,
  amount_total: 7_500_000,
  currency: 'ars',
  client_reference_id: adminUserId,
  metadata: {
    adminUserId,
    subscriptionId: 'default',
    planType: 'PRO',
    billingAmountARS: '75000',
  },
  payment_intent: 'pi_test_paid_1',
  created: Math.floor(Date.now() / 1000),
};

describe('Pro monthly checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DEVELOPER_STRIPE_SECRET_KEY', 'sk_test_checkout');
    vi.stubEnv('STRIPE_ENVIRONMENT', 'sandbox');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://shop.example.test');
    mocks.subscriptionUpsert.mockResolvedValue(subscription);
    mocks.subscriptionUpdate.mockResolvedValue(subscription);
    mocks.subscriptionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.subscriptionFindUnique.mockResolvedValue({ storefrontStatus: 'OPEN' });
    mocks.paymentFindUnique.mockResolvedValue(null);
    mocks.stripeCreate.mockResolvedValue({
      id: 'cs_test_new_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_new_1',
      expires_at: Math.floor(Date.now() / 1000) + 35 * 60,
      livemode: false,
    });
    mocks.stripeRetrieve.mockResolvedValue(paidSession);
    mocks.stripeExpire.mockResolvedValue({ status: 'expired' });
    mocks.txSubscriptionUpsert.mockResolvedValue(subscription);
    mocks.txSubscriptionUpdate.mockResolvedValue(subscription);
    mocks.txPaymentFindUnique.mockResolvedValue(null);
    mocks.txPaymentCreate.mockResolvedValue({ id: 'payment-row-1' });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        storeSubscription: {
          upsert: mocks.txSubscriptionUpsert,
          update: mocks.txSubscriptionUpdate,
        },
        storeSubscriptionPayment: {
          findUnique: mocks.txPaymentFindUnique,
          create: mocks.txPaymentCreate,
        },
      }),
    );
  });

  it('creates a sandbox checkout for ARS 75,000 without activating Pro before payment', async () => {
    const result = await createProPlanCheckoutSession({
      adminUserId,
      email: 'admin@example.test',
      locale: 'es',
    });

    expect(result).toEqual({
      ok: true,
      url: 'https://checkout.stripe.com/c/pay/cs_test_new_1',
      reused: false,
    });
    expect(mocks.stripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ currency: 'ars', unit_amount: 7_500_000 }),
          }),
        ],
        metadata: expect.objectContaining({
          adminUserId,
          planType: 'PRO',
          billingAmountARS: '75000',
        }),
        success_url: expect.stringContaining(
          '/es/dashboard/plan/success?session_id={CHECKOUT_SESSION_ID}',
        ),
      }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining('store-pro-checkout-') }),
    );
    expect(mocks.subscriptionUpdateMany).toHaveBeenCalledWith({
      where: { id: 'default', storefrontStatus: 'OPEN' },
      data: expect.objectContaining({ pendingProCheckoutSessionId: 'cs_test_new_1' }),
    });
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    expect(PRO_CHECKOUT_AMOUNT_ARS).toBe(75_000);
  });

  it('does not start a new Pro checkout after the storefront has closed', async () => {
    mocks.subscriptionUpsert.mockResolvedValueOnce({ ...subscription, storefrontStatus: 'CLOSED' });

    const result = await createProPlanCheckoutSession({
      adminUserId,
      email: 'admin@example.test',
      locale: 'es',
    });

    expect(result).toEqual({ ok: false, code: 'STOREFRONT_CLOSED' });
    expect(mocks.stripeCreate).not.toHaveBeenCalled();
  });

  it('expires a just-created Stripe session if closure wins before the session is saved', async () => {
    mocks.subscriptionUpdateMany.mockResolvedValueOnce({ count: 0 });

    const result = await createProPlanCheckoutSession({
      adminUserId,
      email: 'admin@example.test',
      locale: 'es',
    });

    expect(result).toEqual({ ok: false, code: 'STOREFRONT_CLOSED' });
    expect(mocks.stripeExpire).toHaveBeenCalledWith('cs_test_new_1');
  });

  it('records a payment that already completed but does not activate Pro after closure', async () => {
    mocks.txSubscriptionUpsert.mockResolvedValueOnce({
      ...subscription,
      storefrontStatus: 'CLOSED',
    });

    const result = await completeProPlanCheckout('cs_test_paid_1', adminUserId);

    expect(result).toMatchObject({ alreadyProcessed: false, storefrontClosed: true });
    expect(mocks.txPaymentCreate).toHaveBeenCalled();
    expect(mocks.txSubscriptionUpdate).not.toHaveBeenCalled();
  });

  it('activates Pro only after Stripe verifies a successful sandbox payment and preserves recovery progress', async () => {
    mocks.txSubscriptionUpsert.mockResolvedValue({
      ...subscription,
      planType: 'STANDARD',
      nextPaymentAt: null,
      customizationRecoveryActive: true,
      setupRecoveryStartedAt: new Date('2026-10-20T12:00:00.000Z'),
    });

    const result = await completeProPlanCheckout('cs_test_paid_1', adminUserId);

    expect(result).toMatchObject({ alreadyProcessed: false, paidThrough: expect.any(Date) });
    expect(mocks.txPaymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId,
        stripeCheckoutSessionId: 'cs_test_paid_1',
        stripePaymentIntentId: 'pi_test_paid_1',
        amountARS: 75_000,
        currency: 'ARS',
        status: 'PAID',
      }),
    });
    expect(mocks.txSubscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: expect.objectContaining({
        planType: 'PRO',
        commissionPercent: 2,
        nextPaymentAt: expect.any(Date),
      }),
    });
    const update = mocks.txSubscriptionUpdate.mock.calls[0][0].data;
    expect(update).not.toHaveProperty('customizationRecoveryActive');
    expect(update).not.toHaveProperty('setupRecoveryStartedAt');
    expect(update).not.toHaveProperty('setupRecoveryTarget');
  });

  it('does not activate Pro when the Stripe session has not been paid', async () => {
    mocks.stripeRetrieve.mockResolvedValue({ ...paidSession, payment_status: 'unpaid' });
    await expect(completeProPlanCheckout('cs_test_paid_1', adminUserId)).rejects.toThrow(
      'PRO_CHECKOUT_NOT_PAID_OR_INVALID',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.txSubscriptionUpdate).not.toHaveBeenCalled();
  });

  it('does not apply a checkout session belonging to another administrator', async () => {
    mocks.stripeRetrieve.mockResolvedValue({
      ...paidSession,
      client_reference_id: 'someone-else',
      metadata: { ...paidSession.metadata, adminUserId: 'someone-else' },
    });
    await expect(completeProPlanCheckout('cs_test_paid_1', adminUserId)).rejects.toThrow(
      'PRO_CHECKOUT_NOT_PAID_OR_INVALID',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
