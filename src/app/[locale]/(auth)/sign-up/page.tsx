import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CredentialsForm } from '../_components/CredentialsForm';
import { OAuthButtons } from '../_components/OAuthButtons';

export default async function SignUpPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations('auth');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t('signUpTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('signUpSubtitle')}</p>
      </div>

      <OAuthButtons />

      <div className="relative my-4 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <span className="relative bg-card px-2 text-xs text-muted-foreground uppercase">O</span>
      </div>

      <CredentialsForm mode="sign-up" />
    </div>
  );
}
