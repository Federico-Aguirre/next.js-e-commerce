'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePlatformOwner } from '@/lib/payments/onboarding';
import { CUSTOMIZATION_RECOVERY_PLAN, PRO_PLAN, STANDARD_PLAN } from '@/lib/payments/plan-pricing';
import { getPlatformSubscriptionSummary } from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';

const planSchema = z.enum([STANDARD_PLAN, CUSTOMIZATION_RECOVERY_PLAN, PRO_PLAN]);
const formSchema = z.object({
  planType: planSchema,
  locale: z.enum(['es', 'en']),
  setupRecoveryTarget: z.number().int().min(1).max(10_000_000).optional(),
});

export async function updateDeveloperPlan(formData: FormData) {
  await requirePlatformOwner();

  const localeHint = String(formData.get('locale') ?? 'en') === 'es' ? 'es' : 'en';
  const prefix = localeHint === 'es' ? '/es' : '';
  const rawTarget = String(formData.get('setupRecoveryTarget') ?? '').trim();
  const parsed = formSchema.safeParse({
    planType: String(formData.get('planType') ?? ''),
    locale: String(formData.get('locale') ?? 'en'),
    setupRecoveryTarget: rawTarget ? Number(rawTarget) : undefined,
  });
  if (!parsed.success) redirect(`${prefix}/developer?error=invalid-plan`);

  const { planType, locale } = parsed.data;
  const current = await getPlatformSubscriptionSummary();
  if (planType === PRO_PLAN && !current.proActive) {
    redirect(`${prefix}/developer?error=pro-payment-required`);
  }

  // Recovery is a surcharge toggle, not a mutually exclusive subscription plan.
  // Standard/Pro changes never clear its flag or reset the cycle's start timestamp.
  let basePlanType = current.planType;
  let customizationRecoveryActive = current.customizationRecoveryActive;
  let setupRecoveryStartedAt = current.setupRecoveryStartedAt;
  let setupRecoveryTarget = current.setupRecoveryTarget;
  let nextPaymentAt = current.nextPaymentAt;

  if (planType === CUSTOMIZATION_RECOVERY_PLAN) {
    setupRecoveryTarget = parsed.data.setupRecoveryTarget ?? current.setupRecoveryTarget;
    const startsNewRecoveryCycle =
      !customizationRecoveryActive || current.recoveredAmount >= current.setupRecoveryTarget;
    const amountAlreadyCommitted = startsNewRecoveryCycle
      ? 0
      : current.recoveredAmount + current.reservedAmount;
    if (setupRecoveryTarget < amountAlreadyCommitted) {
      redirect(`${prefix}/developer?error=target-below-progress`);
    }
    if (startsNewRecoveryCycle) setupRecoveryStartedAt = new Date();
    customizationRecoveryActive = true;
  } else if (planType === STANDARD_PLAN) {
    basePlanType = STANDARD_PLAN;
    nextPaymentAt = null;
  }

  const baseCommissionPercent = basePlanType === PRO_PLAN && current.proActive ? 2 : 8;
  await prisma.storeSubscription.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      status: 'ACTIVE',
      planType: basePlanType,
      commissionPercent: baseCommissionPercent,
      setupRecoveryTarget,
      setupRecoveryStartedAt,
      customizationRecoveryActive,
      monthlyPriceARS: current.monthlyPriceARS,
      nextPaymentAt,
    },
    update: {
      status: 'ACTIVE',
      planType: basePlanType,
      commissionPercent: baseCommissionPercent,
      setupRecoveryTarget,
      setupRecoveryStartedAt,
      customizationRecoveryActive,
      nextPaymentAt,
    },
  });

  const resolvedPrefix = locale === 'es' ? '/es' : '';
  revalidatePath(`${resolvedPrefix}/developer`);
  revalidatePath(`${resolvedPrefix}/dashboard`);
  redirect(`${resolvedPrefix}/developer?updated=1`);
}
