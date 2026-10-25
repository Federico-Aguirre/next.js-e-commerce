'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from '@/lib/I18nRouting';
import { StoreConfig } from '@/utils/StoreConfig';
import { updateDeveloperPlan } from './actions';

type PlanType = 'STANDARD' | 'CUSTOMIZATION_RECOVERY' | 'PRO';

type SubscriptionView = {
  status: string;
  planType: 'STANDARD' | 'PRO';
  commissionPercent: number;
  baseCommissionPercent: number;
  proActive: boolean;
  customizationRecoveryActive: boolean;
  setupRecoveryTarget: number;
  setupRecoveryStartedAt: string | null;
  monthlyPriceARS: number;
  nextPaymentAt: string | null;
  recoveredAmount: number;
  reservedAmount: number;
  recoveryRemaining: number;
};

function money(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: StoreConfig.currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function DeveloperPlansClient({
  subscription,
  updated,
  invalidPlan,
  targetBelowProgress,
  proPaymentRequired,
}: {
  subscription: SubscriptionView;
  updated: boolean;
  invalidPlan: boolean;
  targetBelowProgress: boolean;
  proPaymentRequired: boolean;
}) {
  const t = useTranslations('DeveloperPlans');
  const locale = useLocale();
  const [recoveryTarget, setRecoveryTarget] = useState(String(subscription.setupRecoveryTarget));
  const names: Record<'STANDARD' | 'PRO', string> = {
    STANDARD: t('standardName'),
    PRO: t('proName'),
  };
  const plans: Array<{
    id: PlanType;
    title: string;
    description: string;
    price: string;
    commission: string;
  }> = [
    {
      id: 'STANDARD',
      title: t('standardName'),
      description: t('standardDescription'),
      price: t('noMonthlyFee'),
      commission: '8%',
    },
    {
      id: 'CUSTOMIZATION_RECOVERY',
      title: t('recoveryName'),
      description: t('recoveryDescription'),
      price: t('noMonthlyFee'),
      commission: `+${7}%`,
    },
    {
      id: 'PRO',
      title: t('proName'),
      description: t('proDescription'),
      price: money(subscription.monthlyPriceARS, locale) + t('perMonthSuffix'),
      commission: '2%',
    },
  ];
  const recoveryProgress = Math.min(
    100,
    Math.round((subscription.recoveredAmount / subscription.setupRecoveryTarget) * 100),
  );
  const nextPaymentLabel = subscription.nextPaymentAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
        new Date(subscription.nextPaymentAt),
      )
    : t('notScheduled');

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {t('eyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t('subtitle')}</p>
      </header>

      {updated && (
        <p role="status" className="mb-5 rounded-xl border p-3 text-sm">
          {t('updated')}
        </p>
      )}
      {invalidPlan && (
        <p role="alert" className="mb-5 rounded-xl border p-3 text-sm">
          {t('invalidPlan')}
        </p>
      )}
      {targetBelowProgress && (
        <p role="alert" className="mb-5 rounded-xl border p-3 text-sm">
          {t('targetBelowProgress')}
        </p>
      )}
      {proPaymentRequired && (
        <p role="alert" className="mb-5 rounded-xl border p-3 text-sm">
          {t('proMustPayFromDashboard')}
        </p>
      )}

      <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">{t('currentPlan')}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-border bg-background px-3 py-1 text-sm font-medium shadow-sm">
            {names[subscription.planType]}
            {subscription.customizationRecoveryActive && (
              <span className="ml-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs shadow-sm">
                {t('recoveryEnabledBadge')}
              </span>
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            {t('currentCommission', { percent: subscription.commissionPercent })}
          </span>
          {subscription.planType === 'PRO' && (
            <span className="text-sm text-muted-foreground">
              {money(subscription.monthlyPriceARS, locale)}
              {t('perMonthSuffix')}
            </span>
          )}
        </div>

        {(subscription.customizationRecoveryActive ||
          subscription.setupRecoveryStartedAt ||
          subscription.recoveredAmount > 0) && (
          <div className="mt-5 max-w-2xl">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>{t('recoveryProgress')}</span>
              <strong>
                {money(subscription.recoveredAmount, locale)} /{' '}
                {money(subscription.setupRecoveryTarget, locale)}
              </strong>
            </div>
            <div
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={t('recoveryProgress')}
              aria-valuemin={0}
              aria-valuemax={subscription.setupRecoveryTarget}
              aria-valuenow={subscription.recoveredAmount}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${recoveryProgress}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {t('recoveryRemaining', { amount: money(subscription.recoveryRemaining, locale) })}
              </span>
              {subscription.reservedAmount > 0 && (
                <span>
                  {t('recoveryReserved', { amount: money(subscription.reservedAmount, locale) })}
                </span>
              )}
            </div>
          </div>
        )}

        {subscription.planType === 'PRO' && (
          <div className="mt-4 space-y-1 text-sm text-muted-foreground">
            {nextPaymentLabel && <p>{t('nextPayment', { date: nextPaymentLabel })}</p>}
            {!subscription.proActive && <p>{t('proExpiredHint')}</p>}
            <p>{t('monthlyBillingManual')}</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t('availablePlans')}</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isRecoveryCard = plan.id === 'CUSTOMIZATION_RECOVERY';
            const isCurrent = isRecoveryCard
              ? subscription.customizationRecoveryActive
              : subscription.planType === plan.id && (plan.id !== 'PRO' || subscription.proActive);
            const proRequiresPayment = plan.id === 'PRO' && !subscription.proActive;
            return (
              <article
                key={plan.id}
                className="flex h-full flex-col rounded-2xl border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold">{plan.title}</h3>
                  {isCurrent && (
                    <span className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium">
                      {t('active')}
                    </span>
                  )}
                </div>
                <p className="mt-3 min-h-14 text-sm leading-6 text-muted-foreground">
                  {plan.description}
                </p>
                <div className="mt-5 border-t pt-4">
                  <p className="text-2xl font-semibold">{plan.price}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('commissionPerTransaction', { percent: plan.commission })}
                  </p>
                </div>
                {plan.id === 'PRO' && (
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {t('monthlyBillingManual')}
                  </p>
                )}
                {proRequiresPayment ? (
                  <div className="mt-auto space-y-3 pt-6">
                    <p className="text-xs leading-5 text-muted-foreground">
                      {t('proMustPayFromDashboard')}
                    </p>
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {t('goToDashboard')}
                    </Link>
                  </div>
                ) : (
                  <form action={updateDeveloperPlan} className="mt-auto pt-6">
                    <input type="hidden" name="planType" value={plan.id} />
                    <input type="hidden" name="locale" value={locale} />
                    {plan.id === 'CUSTOMIZATION_RECOVERY' && (
                      <div className="mb-4 space-y-2">
                        <label htmlFor="setupRecoveryTarget" className="text-sm font-medium">
                          {t('recoveryTargetLabel')}
                        </label>
                        <Input
                          id="setupRecoveryTarget"
                          name="setupRecoveryTarget"
                          type="number"
                          min={1}
                          max={10_000_000}
                          step={1}
                          required
                          value={recoveryTarget}
                          onChange={(event) => setRecoveryTarget(event.target.value)}
                        />
                        <p className="text-xs leading-5 text-muted-foreground">
                          {t('recoveryTargetHelp')}
                        </p>
                      </div>
                    )}
                    <Button
                      type="submit"
                      variant={isCurrent ? 'secondary' : 'outline'}
                      disabled={isCurrent && plan.id !== 'CUSTOMIZATION_RECOVERY'}
                    >
                      {isCurrent && plan.id === 'CUSTOMIZATION_RECOVERY'
                        ? t('updateRecoveryTarget')
                        : isCurrent
                          ? t('active')
                          : t('activate')}
                    </Button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <p className="mt-6 max-w-4xl text-xs leading-5 text-muted-foreground">{t('feeDefinition')}</p>
    </main>
  );
}
