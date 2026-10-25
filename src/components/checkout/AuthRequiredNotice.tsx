'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

type AuthRequiredNoticeProps = {
  loginLabel?: string;
};

export function AuthRequiredNotice({ loginLabel = 'Ir al login' }: AuthRequiredNoticeProps) {
  return (
    <div className="rounded-xl border border-warning/25 bg-warning/10 p-6 text-center shadow-sm">
      <p className="text-base font-semibold text-warning-foreground">
        No puede acceder sin loguearse
      </p>
      <Button asChild size="lg" className="mt-4">
        <Link href="/login">{loginLabel}</Link>
      </Button>
    </div>
  );
}
