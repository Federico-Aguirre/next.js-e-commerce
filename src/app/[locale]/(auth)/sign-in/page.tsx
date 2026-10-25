import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CredentialsForm } from '../_components/CredentialsForm';
import { OAuthButtons } from '../_components/OAuthButtons';

export default async function SignInPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations('auth');

  return (
    <div className="mx-auto my-auto w-full max-w-sm space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t('signInTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('signInSubtitle')}</p>
      </div>

      <OAuthButtons />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground uppercase">O</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <CredentialsForm mode="sign-in" />
    </div>
  );
}
