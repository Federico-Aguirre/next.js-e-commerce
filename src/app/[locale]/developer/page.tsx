import { redirect } from 'next/navigation';
import { isPlatformOwner } from '@/lib/payments/onboarding';
import { getPlatformSubscriptionSummary } from '@/lib/payments/platform-config';
import DeveloperPlansClient from './DeveloperPlansClient';

type DeveloperPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ updated?: string; error?: string }>;
};

export default async function DeveloperPage({ params, searchParams }: DeveloperPageProps) {
  const { locale } = await params;
  if (!(await isPlatformOwner())) {
    redirect(locale === 'es' ? '/es' : '/');
  }

  const [summary, query] = await Promise.all([
    getPlatformSubscriptionSummary(),
    searchParams ?? Promise.resolve({ updated: undefined, error: undefined }),
  ]);
  const typedQuery: { updated?: string; error?: string } = query;

  return (
    <DeveloperPlansClient
      subscription={{
        status: summary.status,
        planType: summary.planType,
        commissionPercent: summary.commissionPercent,
        baseCommissionPercent: summary.baseCommissionPercent,
        proActive: summary.proActive,
        customizationRecoveryActive: summary.customizationRecoveryActive,
        setupRecoveryTarget: summary.setupRecoveryTarget,
        setupRecoveryStartedAt: summary.setupRecoveryStartedAt?.toISOString() ?? null,
        monthlyPriceARS: summary.monthlyPriceARS,
        nextPaymentAt: summary.nextPaymentAt?.toISOString() ?? null,
        recoveredAmount: summary.recoveredAmount,
        reservedAmount: summary.reservedAmount,
        recoveryRemaining: summary.recoveryRemaining,
      }}
      updated={typedQuery.updated === '1'}
      invalidPlan={typedQuery.error === 'invalid-plan'}
      targetBelowProgress={typedQuery.error === 'target-below-progress'}
      proPaymentRequired={typedQuery.error === 'pro-payment-required'}
    />
  );
}
