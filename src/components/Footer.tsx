import { getTranslations } from 'next-intl/server';

import { Link } from '@/lib/I18nRouting';
import { StoreConfig } from '@/utils/StoreConfig';

export async function Footer() {
  const t = await getTranslations('Storefront.footer');

  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_0.6fr_0.6fr] lg:px-8">
        <div>
          <div className="text-lg font-semibold tracking-tight">
            {StoreConfig.name}
          </div>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            {t('description')}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold">{t('shopTitle')}</p>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <Link href="/products" className="hover:text-foreground">
              {t('catalog')}
            </Link>
            <Link href="/about" className="hover:text-foreground">
              {t('about')}
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold">{t('supportTitle')}</p>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <Link href="/contact" className="hover:text-foreground">
              {t('contact')}
            </Link>
            <Link href="/sign-in" className="hover:text-foreground">
              {t('account')}
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            {t('copyright', {
              year: new Date().getFullYear(),
              name: StoreConfig.name,
            })}
          </span>
          <span>{t('note')}</span>
        </div>
      </div>
    </footer>
  );
}
