import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CredentialsForm } from '../_components/CredentialsForm';
import { OAuthButtons } from '../_components/OAuthButtons';

export default async function SignInPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations('auth');

  return (
    <div className="mx-auto my-auto w-full max-w-sm space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('signInTitle')}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t('signInSubtitle')}
        </p>
      </div>

      <OAuthButtons />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        <span className="text-xs uppercase text-zinc-400">O</span>
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <CredentialsForm mode="sign-in" />
    </div>
  );
}
