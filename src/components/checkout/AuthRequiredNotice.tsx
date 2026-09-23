'use client';

import Link from 'next/link';

type AuthRequiredNoticeProps = {
  loginLabel?: string;
};

export function AuthRequiredNotice({
  loginLabel = 'Ir al login',
}: AuthRequiredNoticeProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
      <p className="text-base font-semibold text-amber-900 dark:text-amber-100">
        No puede acceder sin loguearse
      </p>
      <Link
        href="/login"
        className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        {loginLabel}
      </Link>
    </div>
  );
}
