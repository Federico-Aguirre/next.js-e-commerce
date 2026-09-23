import { getTranslations, setRequestLocale } from 'next-intl/server';

import { HomeContent } from './_home/HomeContent';

type HomePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ loggedIn?: string }>;
};

export default async function HomePage(props: HomePageProps) {
  const { locale } = await props.params;
  const { loggedIn } = await props.searchParams;

  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <div className="flex w-full flex-1 flex-col">
      {loggedIn === 'true' && (
        <div className="mb-4 w-full rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
          {t('loggedInSuccess')}
        </div>
      )}
      <HomeContent locale={locale} />
    </div>
  );
}
