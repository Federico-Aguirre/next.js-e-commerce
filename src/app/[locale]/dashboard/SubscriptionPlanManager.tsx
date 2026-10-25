'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { StoreConfig } from '@/utils/StoreConfig';
import ProPlanPaymentDialog from './ProPlanPaymentDialog';
import { switchToStandardPlan } from './subscription-actions';
import type { DashboardData } from './types';

function money(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: StoreConfig.currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

type SubscriptionInfo = NonNullable<DashboardData['subscription']>;

export default function SubscriptionPlanManager({
  subscription,
  planPaymentStatus,
}: {
  subscription: SubscriptionInfo;
  planPaymentStatus: 'success' | 'cancelled' | 'storeClosed' | null;
}) {
  const t = useTranslations('SubscriptionManager');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [proPaymentDialogOpen, setProPaymentDialogOpen] = useState(false);
  const isStorefrontOpen = subscription.storefrontStatus === 'OPEN';
  const isStandardSelected = subscription.planType === 'STANDARD';
  const isStandardEffective = !subscription.proActive;
  const recoveryProgress =
    subscription.setupRecoveryTarget > 0
      ? Math.min(
          100,
          Math.round((subscription.recoveredAmount / subscription.setupRecoveryTarget) * 100),
        )
      : 0;
  const nextPaymentLabel = subscription.nextPaymentAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
        new Date(subscription.nextPaymentAt),
      )
    : null;

  function chooseStandard() {
    const form = new FormData();
    form.set('locale', locale);
    setFeedback(null);
    startTransition(async () => {
      const result = await switchToStandardPlan(form);
      if (!result.ok) {
        setFeedback(
          result.code === 'PAYMENT_ALREADY_COMPLETED'
            ? t('paymentAlreadyCompleted')
            : result.code === 'STOREFRONT_CLOSED'
              ? t('siteClosedPlanNote')
              : t('switchFailed'),
        );
        return;
      }
      router.refresh();
    });
  }

  function payForPro() {
    setFeedback(null);
    setPaymentSuccess(false);
    setProPaymentDialogOpen(true);
  }

  const showRecovery =
    subscription.customizationRecoveryActive ||
    subscription.recoveredAmount > 0 ||
    Boolean(subscription.setupRecoveryStartedAt);

  return (
    <section
      className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6"
      aria-labelledby="subscription-plan-title"
    >
      <div>
        <h2 id="subscription-plan-title" className="text-xl font-semibold">
          {t('title')}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {planPaymentStatus === 'success' && (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {t('paymentSuccess')}
        </p>
      )}
      {planPaymentStatus === 'cancelled' && (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {t('paymentCancelled')}
        </p>
      )}
      {planPaymentStatus === 'storeClosed' && (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {t('paymentStoreClosed')}
        </p>
      )}
      {!isStorefrontOpen && (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {t('siteClosedPlanNote')}
        </p>
      )}
      {paymentSuccess && (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {t('paymentSuccess')}
        </p>
      )}
      {feedback && (
        <p role="alert" className="rounded-xl border p-3 text-sm">
          {feedback}
        </p>
      )}

      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">{t('currentPlan')}</p>
        <p className="mt-1 text-lg font-semibold">
          {subscription.proActive ? t('proName') : t('standardName')}
          {subscription.planType === 'PRO' && !subscription.proActive
            ? ` · ${t('proExpired')}`
            : ''}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('currentCommission', { percent: subscription.commissionPercent })}
        </p>
        {subscription.proActive && nextPaymentLabel && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t('nextPayment', { date: nextPaymentLabel })}
          </p>
        )}
        {subscription.planType === 'PRO' && !subscription.proActive && (
          <p className="mt-2 text-sm text-muted-foreground">{t('proExpiredHint')}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="flex flex-col rounded-xl border bg-background p-4">
          <h3 className="text-lg font-semibold">{t('standardName')}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('standardDescription')}</p>
          <p className="mt-4 text-2xl font-semibold">8%</p>
          <p className="text-sm text-muted-foreground">{t('commissionPerTransaction')}</p>
          <Button
            type="button"
            className="mt-5"
            variant={isStandardEffective && isStandardSelected ? 'secondary' : 'outline'}
            disabled={pending || !isStorefrontOpen || (isStandardEffective && isStandardSelected)}
            onClick={chooseStandard}
          >
            {pending && !isStandardSelected
              ? t('processing')
              : isStandardEffective && isStandardSelected
                ? t('active')
                : t('chooseStandard')}
          </Button>
        </article>

        <article className="flex flex-col rounded-xl border bg-background p-4">
          <h3 className="text-lg font-semibold">{t('proName')}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('proDescription')}</p>
          <p className="mt-4 text-2xl font-semibold">
            {money(subscription.monthlyPriceARS, locale)}
          </p>
          <p className="text-sm text-muted-foreground">{t('perMonth')}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('proCommission')}</p>
          <Button
            type="button"
            className="mt-5"
            variant={subscription.proActive ? 'secondary' : 'default'}
            disabled={pending || !isStorefrontOpen || subscription.proActive}
            onClick={payForPro}
          >
            {pending && !subscription.proActive
              ? t('processing')
              : subscription.proActive
                ? t('active')
                : subscription.planType === 'PRO'
                  ? t('renewPro')
                  : t('chooseProAndPay', { amount: money(subscription.monthlyPriceARS, locale) })}
          </Button>
        </article>
      </div>

      {showRecovery && (
        <section className="rounded-xl border p-4" aria-labelledby="customization-recovery-title">
          <h3 id="customization-recovery-title" className="font-semibold">
            {t('recoveryTitle')}
          </h3>
          {subscription.customizationRecoveryActive ? (
            <>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t('recoveryActiveDescription')}
              </p>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
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
                  {t('recoveryRemaining', {
                    amount: money(subscription.recoveryRemaining, locale),
                  })}
                </span>
                {subscription.reservedAmount > 0 && (
                  <span>
                    {t('recoveryReserved', { amount: money(subscription.reservedAmount, locale) })}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('recoveryPaidDescription')}
            </p>
          )}
        </section>
      )}

      <p className="text-xs leading-5 text-muted-foreground">{t('billingNote')}</p>
      <ProPlanPaymentDialog
        open={proPaymentDialogOpen}
        onClose={() => setProPaymentDialogOpen(false)}
        onSuccess={() => {
          setProPaymentDialogOpen(false);
          setPaymentSuccess(true);
          setFeedback(null);
          router.refresh();
        }}
      />
    </section>
  );
}
