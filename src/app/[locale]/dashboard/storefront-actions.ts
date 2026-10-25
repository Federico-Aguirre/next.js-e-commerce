'use server';

import { revalidatePath } from 'next/cache';
import { expirePendingProCheckout } from '@/lib/payments/pro-plan-checkout';
import { prisma } from '@/lib/prisma';
import { requireDashboardAdmin } from './data';

type LifecycleResult =
  | { ok: true; status: 'OPEN' | 'CLOSED' }
  | {
      ok: false;
      code:
        | 'CLOSURE_IN_PROGRESS'
        | 'PLAN_CHECKOUT_CANCEL_FAILED'
        | 'PRO_PAYMENT_PENDING'
        | 'REOPEN_FAILED'
        | 'INTERNAL_ERROR';
    };

function revalidateStorefront(locale: string) {
  revalidatePath('/', 'layout');
  revalidatePath('/dashboard');
  revalidatePath('/es/dashboard');
  revalidatePath('/en/dashboard');
  revalidatePath('/developer');
  revalidatePath('/es/developer');
  revalidatePath('/en/developer');
  if (locale === 'es') revalidatePath('/es');
  else revalidatePath('/');
}

async function ensureSubscriptionRow() {
  return prisma.storeSubscription.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      status: 'ACTIVE',
      planType: 'STANDARD',
      commissionPercent: 8,
      monthlyPriceARS: 75_000,
      setupRecoveryTarget: 200_000,
      customizationRecoveryActive: false,
      storefrontStatus: 'OPEN',
    },
    update: {},
  });
}

/**
 * Starts an OPEN -> CLOSING transition before cancelling the subscription's own
 * pending Pro checkout. The temporary state prevents a new order or new Pro
 * checkout from slipping in while the remote Stripe session is being expired.
 */
export async function closeStorefront(): Promise<LifecycleResult> {
  await requireDashboardAdmin();
  let claimAcquired = false;

  try {
    await ensureSubscriptionRow();
    // Serialize closure with a new Pro payment registration on the same row.
    // A pending-payment pointer prevents the site from entering CLOSING.
    const claim = await prisma.storeSubscription.updateMany({
      where: {
        id: 'default',
        storefrontStatus: 'OPEN',
        pendingProPaymentId: null,
      },
      data: { storefrontStatus: 'CLOSING' },
    });

    if (claim.count !== 1) {
      const current = await prisma.storeSubscription.findUnique({
        where: { id: 'default' },
        select: { storefrontStatus: true, pendingProPaymentId: true },
      });
      if (current?.pendingProPaymentId) {
        return { ok: false, code: 'PRO_PAYMENT_PENDING' };
      }
      if (current?.storefrontStatus === 'CLOSED') {
        revalidateStorefront('es');
        return { ok: true, status: 'CLOSED' };
      }
      return { ok: false, code: 'CLOSURE_IN_PROGRESS' };
    }

    claimAcquired = true;
    const current = await prisma.storeSubscription.findUnique({
      where: { id: 'default' },
      select: {
        pendingProCheckoutSessionId: true,
        pendingProPaymentId: true,
      },
    });

    if (current?.pendingProPaymentId) {
      await prisma.storeSubscription.updateMany({
        where: { id: 'default', storefrontStatus: 'CLOSING' },
        data: { storefrontStatus: 'OPEN' },
      });
      claimAcquired = false;
      return { ok: false, code: 'PRO_PAYMENT_PENDING' };
    }

    if (current?.pendingProCheckoutSessionId) {
      try {
        await expirePendingProCheckout(current.pendingProCheckoutSessionId);
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        // Stripe has already accepted payment. We cannot reverse a completed
        // charge here, but the closed-state finalizer will not reactivate Pro.
        if (code !== 'PRO_CHECKOUT_ALREADY_PAID') {
          await prisma.storeSubscription.updateMany({
            where: { id: 'default', storefrontStatus: 'CLOSING' },
            data: { storefrontStatus: 'OPEN' },
          });
          claimAcquired = false;
          return { ok: false, code: 'PLAN_CHECKOUT_CANCEL_FAILED' };
        }
      }
    }

    const closedAt = new Date();
    const closed = await prisma.storeSubscription.updateMany({
      where: { id: 'default', storefrontStatus: 'CLOSING' },
      data: {
        storefrontStatus: 'CLOSED',
        storefrontClosedAt: closedAt,
        pendingProCheckoutSessionId: null,
        pendingProCheckoutExpiresAt: null,
      },
    });

    if (closed.count !== 1) {
      const currentStatus = await prisma.storeSubscription.findUnique({
        where: { id: 'default' },
        select: { storefrontStatus: true },
      });
      if (currentStatus?.storefrontStatus === 'CLOSED') {
        claimAcquired = false;
        revalidateStorefront('es');
        return { ok: true, status: 'CLOSED' };
      }
      throw new Error('STOREFRONT_CLOSE_FINALIZATION_FAILED');
    }

    claimAcquired = false;
    revalidateStorefront('es');
    return { ok: true, status: 'CLOSED' };
  } catch (error) {
    if (claimAcquired) {
      try {
        await prisma.storeSubscription.updateMany({
          where: { id: 'default', storefrontStatus: 'CLOSING' },
          data: { storefrontStatus: 'OPEN' },
        });
      } catch {
        // Keep the original error; the dashboard will report that closure failed.
      }
    }
    console.error(
      'Storefront closure failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return { ok: false, code: 'INTERNAL_ERROR' };
  }
}

/** Reopening preserves orders, subscription-payment history and recovery progress. */
export async function reopenStorefront(): Promise<LifecycleResult> {
  await requireDashboardAdmin();

  try {
    await ensureSubscriptionRow();
    const reopened = await prisma.storeSubscription.updateMany({
      where: { id: 'default', storefrontStatus: 'CLOSED' },
      data: { storefrontStatus: 'OPEN' },
    });

    if (reopened.count === 0) {
      const current = await prisma.storeSubscription.findUnique({
        where: { id: 'default' },
        select: { storefrontStatus: true },
      });
      if (current?.storefrontStatus === 'OPEN') {
        revalidateStorefront('es');
        return { ok: true, status: 'OPEN' };
      }
      return {
        ok: false,
        code: current?.storefrontStatus === 'CLOSING' ? 'CLOSURE_IN_PROGRESS' : 'REOPEN_FAILED',
      };
    }

    revalidateStorefront('es');
    return { ok: true, status: 'OPEN' };
  } catch (error) {
    console.error(
      'Storefront reopening failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return { ok: false, code: 'INTERNAL_ERROR' };
  }
}
