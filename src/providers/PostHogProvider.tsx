'use client';

import { useSession } from 'next-auth/react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, useRef, useState } from 'react';
import { Env } from '@/lib/Env';
import {
  ANALYTICS_CONSENT_EVENT,
  readAnalyticsConsent,
  type AnalyticsConsent,
} from '@/lib/privacy/analytics-consent';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [analyticsConsent, setAnalyticsConsent] = useState<AnalyticsConsent>('pending');
  const posthogInitialized = useRef(false);

  useEffect(() => {
    const syncConsent = () => setAnalyticsConsent(readAnalyticsConsent());
    syncConsent();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, syncConsent);
    window.addEventListener('storage', syncConsent);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, syncConsent);
      window.removeEventListener('storage', syncConsent);
    };
  }, []);

  useEffect(() => {
    if (!Env.NEXT_PUBLIC_POSTHOG_KEY) return;

    if (analyticsConsent !== 'accepted') {
      if (posthogInitialized.current) {
        posthog.opt_out_capturing();
        posthog.reset();
      }
      return;
    }

    if (!posthogInitialized.current) {
      posthog.init(Env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: Env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: true,
        disable_session_recording: false,
        loaded: (ph) => {
          if (Env.NODE_ENV === 'development') ph.debug();
        },
      });
      posthogInitialized.current = true;
    } else {
      posthog.opt_in_capturing();
    }
  }, [analyticsConsent]);

  useEffect(() => {
    if (analyticsConsent !== 'accepted') return;

    const visitKey = 'nova_store_visit_tracked';
    if (sessionStorage.getItem(visitKey)) return;

    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const sessionId = crypto.randomUUID();

    void fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, device: isMobile ? 'mobile' : 'desktop' }),
    })
      .then((response) => {
        if (response.ok) sessionStorage.setItem(visitKey, '1');
      })
      .catch(() => undefined);
  }, [analyticsConsent]);

  useEffect(() => {
    if (analyticsConsent !== 'accepted') return;

    if (status === 'authenticated' && session?.user) {
      const userId = session.user.id || session.user.email || '';
      if (userId) {
        posthog.identify(userId, {
          email: session.user.email,
          name: session.user.name,
        });
      }
    } else if (status === 'unauthenticated' && posthogInitialized.current) {
      posthog.reset();
    }
  }, [analyticsConsent, status, session]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
