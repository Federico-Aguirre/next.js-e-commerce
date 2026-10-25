import 'server-only';
import { prisma } from '@/lib/prisma';
import {
  PRO_COMMISSION_PERCENT,
  PRO_PLAN,
  STANDARD_COMMISSION_PERCENT,
  STANDARD_PLAN,
} from './plan-pricing';
import { DEFAULT_PRO_MONTHLY_PRICE_ARS } from './plan-pricing';
import { nextBuenosAiresMonthStart } from './pro-plan-checkout';

export const PRO_PLAN_AMOUNT_ARS = DEFAULT_PRO_MONTHLY_PRICE_ARS;
export type ProPaymentProvider = 'STRIPE' | 'PAYPAL' | 'MERCADOPAGO';

export class ProPlanBillingError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ProPlanBillingError';
  }
}

export function getProPlanPaidThrough(
  planType: string,
  nextPaymentAt: Date | null,
  paidAt = new Date(),
) {
  const anchor =
    planType === PRO_PLAN && nextPaymentAt && nextPaymentAt.getTime() > paidAt.getTime()
      ? nextPaymentAt
      : paidAt;
  return nextBuenosAiresMonthStart(anchor);
}

export async function assertProPlanCanBePurchased() {
  const subscription = await prisma.storeSubscription.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      status: 'ACTIVE',
      planType: STANDARD_PLAN,
      commissionPercent: STANDARD_COMMISSION_PERCENT,
      monthlyPriceARS: PRO_PLAN_AMOUNT_ARS,
      customizationRecoveryActive: false,
      storefrontStatus: 'OPEN',
    },
    update: {},
  });

  if (subscription.storefrontStatus !== 'OPEN') {
    throw new ProPlanBillingError('STOREFRONT_CLOSED');
  }
  if (
    subscription.planType === PRO_PLAN &&
    subscription.nextPaymentAt &&
    subscription.nextPaymentAt.getTime() > Date.now()
  ) {
    throw new ProPlanBillingError('PRO_ALREADY_ACTIVE');
  }
  if (
    subscription.pendingProPaymentId ||
    (subscription.pendingProCheckoutSessionId &&
      subscription.pendingProCheckoutExpiresAt &&
      subscription.pendingProCheckoutExpiresAt.getTime() > Date.now())
  ) {
    throw new ProPlanBillingError('PRO_PAYMENT_PENDING');
  }
  return subscription;
}

export async function findProPaymentAttempt(paymentAttemptId: string) {
  return prisma.storeSubscriptionPayment.findUnique({
    where: { paymentAttemptId },
  });
}

export async function registerPendingProPayment(input: {
  adminUserId: string;
  provider: ProPaymentProvider;
  externalPaymentId: string;
  paymentAttemptId: string;
  paymentAmount: number;
  paymentCurrency: 'ARS' | 'USD';
  exchangeRate: number;
  expiresAt: Date;
  savedPaymentMethodId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.storeSubscription.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        status: 'ACTIVE',
        planType: STANDARD_PLAN,
        commissionPercent: STANDARD_COMMISSION_PERCENT,
        monthlyPriceARS: PRO_PLAN_AMOUNT_ARS,
        customizationRecoveryActive: false,
        storefrontStatus: 'OPEN',
      },
      update: {},
    });

    const previousAttempt = await tx.storeSubscriptionPayment.findUnique({
      where: { paymentAttemptId: input.paymentAttemptId },
    });
    if (previousAttempt) {
      if (
        previousAttempt.adminUserId !== input.adminUserId ||
        previousAttempt.paymentProvider !== input.provider
      ) {
        throw new ProPlanBillingError('PAYMENT_ATTEMPT_OWNER_MISMATCH');
      }
      if (previousAttempt.externalPaymentId !== input.externalPaymentId) {
        throw new ProPlanBillingError('PAYMENT_ATTEMPT_MISMATCH');
      }
      if (previousAttempt.status === 'FAILED') {
        throw new ProPlanBillingError('PAYMENT_ATTEMPT_ALREADY_FAILED');
      }
      return previousAttempt;
    }

    if (current.storefrontStatus !== 'OPEN') {
      throw new ProPlanBillingError('STOREFRONT_CLOSED');
    }
    if (
      current.planType === PRO_PLAN &&
      current.nextPaymentAt &&
      current.nextPaymentAt.getTime() > Date.now()
    ) {
      throw new ProPlanBillingError('PRO_ALREADY_ACTIVE');
    }
    if (
      current.pendingProPaymentId &&
      current.pendingProPaymentExpiresAt &&
      current.pendingProPaymentExpiresAt.getTime() > Date.now()
    ) {
      throw new ProPlanBillingError('PRO_PAYMENT_PENDING');
    }

    const dueDate = getProPlanPaidThrough(current.planType, current.nextPaymentAt);
    const payment = await tx.storeSubscriptionPayment.create({
      data: {
        subscriptionId: 'default',
        adminUserId: input.adminUserId,
        paymentProvider: input.provider,
        externalPaymentId: input.externalPaymentId,
        paymentAttemptId: input.paymentAttemptId,
        paymentMethodRef: input.savedPaymentMethodId ?? null,
        amountARS: PRO_PLAN_AMOUNT_ARS,
        paymentAmount: input.paymentAmount,
        paymentCurrency: input.paymentCurrency,
        exchangeRate: input.exchangeRate,
        currency: 'ARS',
        status: 'PENDING',
        paidThrough: dueDate,
      },
    });

    const locked = await tx.storeSubscription.updateMany({
      where: {
        id: 'default',
        storefrontStatus: 'OPEN',
        pendingProPaymentId: null,
      },
      data: {
        pendingProPaymentId: input.externalPaymentId,
        pendingProPaymentProvider: input.provider,
        pendingProPaymentExpiresAt: input.expiresAt,
      },
    });
    if (locked.count !== 1) throw new ProPlanBillingError('PRO_PAYMENT_PENDING');
    return payment;
  });
}

/**
 * Record the provider-confirmed payment exactly once. If closure won a race,
 * preserve the charge history but do not silently reopen the storefront.
 */
export async function completeRegisteredProPayment(input: {
  adminUserId: string;
  provider: ProPaymentProvider;
  paymentAttemptId: string;
  providerTransactionId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.storeSubscriptionPayment.findUnique({
      where: { paymentAttemptId: input.paymentAttemptId },
    });
    if (
      !payment ||
      payment.adminUserId !== input.adminUserId ||
      payment.paymentProvider !== input.provider
    ) {
      throw new ProPlanBillingError('PRO_PAYMENT_NOT_FOUND');
    }

    const current = await tx.storeSubscription.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        status: 'ACTIVE',
        planType: STANDARD_PLAN,
        commissionPercent: STANDARD_COMMISSION_PERCENT,
        monthlyPriceARS: PRO_PLAN_AMOUNT_ARS,
        customizationRecoveryActive: false,
        storefrontStatus: 'OPEN',
      },
      update: {},
    });

    if (payment.status === 'PAID') {
      return {
        alreadyProcessed: true,
        activated:
          current.storefrontStatus === 'OPEN' &&
          current.planType === PRO_PLAN &&
          Boolean(current.nextPaymentAt && current.nextPaymentAt.getTime() > Date.now()),
        paidThrough: payment.paidThrough,
        storefrontClosed: current.storefrontStatus !== 'OPEN',
      };
    }

    const paidAt = new Date();
    const paidThrough = getProPlanPaidThrough(current.planType, current.nextPaymentAt, paidAt);
    await tx.storeSubscriptionPayment.update({
      where: { paymentAttemptId: input.paymentAttemptId },
      data: {
        status: 'PAID',
        paidAt,
        paidThrough,
        ...(input.providerTransactionId
          ? { providerTransactionId: input.providerTransactionId }
          : {}),
      },
    });

    const mayActivate =
      current.storefrontStatus === 'OPEN' &&
      current.pendingProPaymentId === payment.externalPaymentId &&
      current.pendingProPaymentProvider === input.provider;

    if (mayActivate) {
      await tx.storeSubscription.update({
        where: { id: 'default' },
        data: {
          status: 'ACTIVE',
          planType: PRO_PLAN,
          commissionPercent: PRO_COMMISSION_PERCENT,
          nextPaymentAt: payment.paidThrough,
          pendingProPaymentId: null,
          pendingProPaymentProvider: null,
          pendingProPaymentExpiresAt: null,
          pendingProCheckoutSessionId: null,
          pendingProCheckoutExpiresAt: null,
        },
      });
    } else {
      await tx.storeSubscription.updateMany({
        where: {
          id: 'default',
          pendingProPaymentId: payment.externalPaymentId,
          pendingProPaymentProvider: input.provider,
        },
        data: {
          pendingProPaymentId: null,
          pendingProPaymentProvider: null,
          pendingProPaymentExpiresAt: null,
        },
      });
    }

    return {
      alreadyProcessed: false,
      activated: mayActivate,
      paidThrough: payment.paidThrough,
      storefrontClosed: current.storefrontStatus !== 'OPEN',
    };
  });
}

export async function failRegisteredProPayment(input: {
  adminUserId: string;
  provider: ProPaymentProvider;
  paymentAttemptId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.storeSubscriptionPayment.findUnique({
      where: { paymentAttemptId: input.paymentAttemptId },
    });
    if (
      !payment ||
      payment.adminUserId !== input.adminUserId ||
      payment.paymentProvider !== input.provider
    ) {
      return;
    }
    if (payment.status !== 'PAID') {
      await tx.storeSubscriptionPayment.update({
        where: { paymentAttemptId: input.paymentAttemptId },
        data: { status: 'FAILED' },
      });
    }
    await tx.storeSubscription.updateMany({
      where: {
        id: 'default',
        pendingProPaymentId: payment.externalPaymentId,
        pendingProPaymentProvider: input.provider,
      },
      data: {
        pendingProPaymentId: null,
        pendingProPaymentProvider: null,
        pendingProPaymentExpiresAt: null,
      },
    });
  });
}
