import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CredentialsForm } from '../_components/CredentialsForm';
import { OAuthButtons } from '../_components/OAuthButtons';

export default async function SignUpPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations('auth');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('signUpTitle')}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t('signUpSubtitle')}
        </p>
      </div>

      <OAuthButtons />

      <div className="relative my-4 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
        </div>
        <span className="relative bg-white px-2 text-xs uppercase text-zinc-400 dark:bg-zinc-800">
          O
        </span>
      </div>

      <CredentialsForm mode="sign-up" />
    </div>
  );
}
