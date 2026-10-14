'use client';

import { useLocale, useTranslations } from 'next-intl';
import { StoreConfig } from '@/utils/StoreConfig';

function money(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: StoreConfig.currency,
  }).format(amount);
}

export default function SubscriptionCard({
  commissionPercent,
  monthlyCompletedRevenue,
  commissionAmount,
}: {
  commissionPercent: number;
  monthlyCompletedRevenue: number;
  commissionAmount: number;
}) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();

  return (
    <section className="rounded-2xl border p-5">
      <div>
        <h2 className="text-lg font-semibold">{t('subscription')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('serviceSummaryNote')}</p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">{t('monthlyCompletedRevenue')}</p>
          <p className="mt-2 text-2xl font-semibold">{money(monthlyCompletedRevenue, locale)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('monthlyCompletedRevenueHint')}</p>
        </article>

        <article className="rounded-xl border bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">
            {t('monthlyServiceShare', { percent: commissionPercent })}
          </p>
          <p className="mt-2 text-2xl font-semibold">{money(commissionAmount, locale)}</p>
        </article>
      </div>
    </section>
  );
}
