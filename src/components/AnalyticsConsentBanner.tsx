'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ANALYTICS_CONSENT_EVENT,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from '@/lib/privacy/analytics-consent';

export default function AnalyticsConsentBanner() {
  const pathname = usePathname();
  const es = pathname.startsWith('/es');
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = readAnalyticsConsent();
      setOpen(next === 'pending');
      setReady(true);
    };
    sync();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  function choose(next: 'accepted' | 'rejected') {
    writeAnalyticsConsent(next);
    setOpen(false);
    setReady(true);
  }

  function reopen() {
    writeAnalyticsConsent('pending');
    setOpen(true);
  }

  if (!ready) return null;

  return (
    <>
      {open ? (
        <aside
          aria-label={es ? 'Preferencias de cookies' : 'Cookie preferences'}
          className="fixed right-3 bottom-3 z-[100] w-[min(94vw,30rem)] rounded-2xl border bg-background p-5 shadow-2xl sm:right-6 sm:bottom-6"
        >
          <h2 className="text-base font-semibold">
            {es ? 'Privacidad y analítica' : 'Privacy and analytics'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {es
              ? 'Las tecnologías esenciales mantienen el carrito y la sesión. La analítica opcional de PostHog y las estadísticas de visitas pueden medir navegación e interacciones; solo se activan si las aceptás. Podés cambiar tu elección más tarde.'
              : 'Essential technologies keep the cart and session working. Optional PostHog analytics and visit statistics may measure navigation and interactions; they are enabled only if you accept. You can change your choice later.'}{' '}
            <Link
              href={es ? '/es/legal#cookies' : '/legal#cookies'}
              className="underline underline-offset-4"
            >
              {es ? 'Leer la política de privacidad' : 'Read the privacy policy'}
            </Link>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => choose('accepted')}
              className="min-h-10 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {es ? 'Aceptar analítica opcional' : 'Accept optional analytics'}
            </button>
            <button
              type="button"
              onClick={() => choose('rejected')}
              className="min-h-10 cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium"
            >
              {es ? 'Rechazar analítica' : 'Reject analytics'}
            </button>
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={reopen}
          className="fixed bottom-3 left-3 z-[90] rounded-full border bg-background/95 px-3 py-2 text-xs font-medium shadow-lg sm:bottom-4 sm:left-4"
        >
          {es ? 'Preferencias de cookies' : 'Cookie preferences'}
        </button>
      )}
    </>
  );
}
