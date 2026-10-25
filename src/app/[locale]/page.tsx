import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { HomeContent } from './_home/HomeContent';

type HomePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ loggedIn?: string }>;
};

async function LoginStatusBanner({
  searchParams,
  message,
}: {
  searchParams: HomePageProps['searchParams'];
  message: string;
}) {
  const { loggedIn } = await searchParams;

  if (loggedIn !== 'true') {
    return null;
  }

  return (
    <div className="mb-4 w-full rounded-lg border border-success/20 bg-success/10 p-4 text-sm text-success">
      {message}
    </div>
  );
}

export default async function HomePage(props: HomePageProps) {
  const { locale } = await props.params;

  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <div className="flex w-full flex-1 flex-col">
      <Suspense fallback={null}>
        <LoginStatusBanner searchParams={props.searchParams} message={t('loggedInSuccess')} />
      </Suspense>
      <HomeContent locale={locale} />
    </div>
  );
}
