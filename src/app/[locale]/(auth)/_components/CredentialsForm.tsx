'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';

import { signInAction, signUpAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useRouter } from '@/lib/I18nRouting';

type CredentialsFormProps = {
  mode: 'sign-in' | 'sign-up';
};

type ActionResult = {
  success?: boolean;
  error?: string;
} | null;

export function CredentialsForm({ mode }: CredentialsFormProps) {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRegistered = searchParams.get('registered') === 'true';

  const action = mode === 'sign-in' ? signInAction : signUpAction;

  const [state, formAction, isPending] = useActionState(
    async (prevState: ActionResult, formData: FormData) => {
      const result = await action(prevState, formData);

      if (result?.success) {
        if (mode === 'sign-up') {
          router.push({
            pathname: '/sign-in',
            query: { registered: 'true' },
          });
        } else {
          router.push({
            pathname: '/',
            query: { loggedIn: 'true' },
          });
          router.refresh();
        }
      }
      return result;
    },
    null,
  );

  let buttonLabel = mode === 'sign-in' ? t('signInButton') : t('signUpButton');
  if (isPending) {
    buttonLabel = t('loading');
  }

  return (
    <form action={formAction} className="space-y-4">
      {mode === 'sign-in' && isRegistered && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          ¡Cuenta creada exitosamente! Ya puedes iniciar sesión.
        </div>
      )}

      {state?.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500">
          {state.error}
        </div>
      )}

      {mode === 'sign-up' && (
        <div className="space-y-2">
          <Label htmlFor="name">{t('nameLabel')}</Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            placeholder="John Doe"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t('emailLabel')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="tu@email.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('passwordLabel')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          placeholder="••••••••"
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {buttonLabel}
      </Button>

      <p className="pt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
        {mode === 'sign-in' ? (
          <>
            {t('noAccount')}{' '}
            <Link
              href="/sign-up"
              className="font-semibold text-zinc-900 underline dark:text-zinc-100"
            >
              {t('signUpLink')}
            </Link>
          </>
        ) : (
          <>
            {t('alreadyHaveAccount')}{' '}
            <Link
              href="/sign-in"
              className="font-semibold text-zinc-900 underline dark:text-zinc-100"
            >
              {t('signInLink')}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
