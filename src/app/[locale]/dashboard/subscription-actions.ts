'use server';

import { revalidatePath } from 'next/cache';
import { STANDARD_COMMISSION_PERCENT, STANDARD_PLAN } from '@/lib/payments/plan-pricing';
import {
  createProPlanCheckoutSession,
  expirePendingProCheckout,
} from '@/lib/payments/pro-plan-checkout';
import { prisma } from '@/lib/prisma';
import { requireDashboardAdmin } from './data';

function localePrefix(value: FormDataEntryValue | null) {
  return String(value ?? 'es') === 'es' ? '/es' : '';
}

export async function startProPlanCheckout(formData: FormData) {
  const admin = await requireDashboardAdmin();
  const adminUserId = admin.user.id;
  if (!adminUserId) return { ok: false as const, code: 'CHECKOUT_FAILED' as const };
  const locale = String(formData.get('locale') ?? 'en') === 'es' ? 'es' : 'en';
  const result = await createProPlanCheckoutSession({
    adminUserId,
    email: admin.user.email,
    locale,
  });
  return result;
}

export async function switchToStandardPlan(formData: FormData) {
  await requireDashboardAdmin();
  const prefix = localePrefix(formData.get('locale'));
  const current = await prisma.storeSubscription.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      status: 'ACTIVE',
      planType: STANDARD_PLAN,
      commissionPercent: STANDARD_COMMISSION_PERCENT,
      customizationRecoveryActive: false,
      setupRecoveryTarget: 200_000,
      monthlyPriceARS: 75_000,
    },
    update: {},
  });

  if (current.storefrontStatus !== 'OPEN') {
    return { ok: false as const, code: 'STOREFRONT_CLOSED' as const };
  }
  if (current.pendingProPaymentId) {
    return { ok: false as const, code: 'CHECKOUT_PENDING' as const };
  }

  try {
    if (current.pendingProCheckoutSessionId) {
      await expirePendingProCheckout(current.pendingProCheckoutSessionId);
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return {
      ok: false as const,
      code: code === 'PRO_CHECKOUT_ALREADY_PAID' ? 'PAYMENT_ALREADY_COMPLETED' : 'CHECKOUT_PENDING',
    };
  }

  await prisma.storeSubscription.update({
    where: { id: 'default' },
    data: {
      status: 'ACTIVE',
      planType: STANDARD_PLAN,
      commissionPercent: STANDARD_COMMISSION_PERCENT,
      nextPaymentAt: null,
      pendingProCheckoutSessionId: null,
      pendingProCheckoutExpiresAt: null,
      // Deliberately preserve customizationRecoveryActive, setupRecoveryStartedAt,
      // setupRecoveryTarget and the payment history. Plan changes must not erase progress.
    },
  });

  revalidatePath(`${prefix}/dashboard`);
  revalidatePath(`${prefix}/developer`);
  return { ok: true as const };
}
