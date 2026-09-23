'use client';

import { useTranslations } from 'next-intl';

import { signOutAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/lib/I18nRouting';

export function SignOutButton() {
  const t = useTranslations('RootLayout');
  const router = useRouter();

  const handleSignOut = async () => {
    await signOutAction();
    router.push('/');
    router.refresh();
  };

  return (
    <Button onClick={handleSignOut} variant="secondary" size="sm">
      {t('sign_out_link')}
    </Button>
  );
}
