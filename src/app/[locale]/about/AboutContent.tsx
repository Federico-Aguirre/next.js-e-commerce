'use client';

import { useTranslations } from 'next-intl';

export function AboutContent() {
  const t = useTranslations('About');

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
      <p className="max-w-2xl text-muted-foreground">{t('description')}</p>
    </section>
  );
}
