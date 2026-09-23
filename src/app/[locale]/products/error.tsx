'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

export default function Error({ reset }: { reset: () => void }) {
  const t = useTranslations('Storefront.catalog');

  return (
    <div className="flex min-h-[60dvh] items-center justify-center py-12">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('errorTitle')}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t('errorDescription')}
        </p>
        <Button type="button" className="mt-6" onClick={reset}>
          {t('retry')}
        </Button>
      </div>
    </div>
  );
}
