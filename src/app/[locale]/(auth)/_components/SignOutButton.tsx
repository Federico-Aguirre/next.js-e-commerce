'use client';

import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/lib/I18nRouting';

export function SignOutButton() {
  const t = useTranslations('RootLayout');
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
    router.refresh();
  };

  return (
    <Button onClick={handleSignOut} variant="secondary" size="sm">
      {t('sign_out_link')}
    </Button>
  );
}
