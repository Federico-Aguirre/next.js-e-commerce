'use client';

import { useTranslations } from 'next-intl';
import { usePathname as useNextPathname } from 'next/navigation';
import type { ChangeEventHandler } from 'react';
import { Select } from '@/components/ui/select';
import { usePathname, useRouter } from '@/lib/I18nNavigation';
import { routing } from '@/lib/I18nRouting';

export const LocaleSwitcher = () => {
  const t = useTranslations('LocaleSwitcher');
  const router = useRouter();
  const pathname = usePathname();
  const nextPathname = useNextPathname();
  const locale = nextPathname.startsWith('/es') ? 'es' : 'en';

  const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    const newLocale = event.target.value;

    if (newLocale === locale) {
      return;
    }

    router.replace(pathname, { locale: newLocale, scroll: false });
  };

  return (
    <Select
      value={locale}
      onChange={handleChange}
      className="cursor-pointer rounded-md border border-border bg-card px-2 py-1 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t('change_language')}
    >
      {routing.locales.map((elt) => (
        <option key={elt} value={elt} className="bg-card text-foreground">
          {elt.toUpperCase()}
        </option>
      ))}
    </Select>
  );
};
