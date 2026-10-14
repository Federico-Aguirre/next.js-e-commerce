'use client';

import { useSession } from 'next-auth/react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { Env } from '@/lib/Env';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (typeof window !== 'undefined' && Env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(Env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: Env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: true,
        disable_session_recording: false,
        loaded: (ph) => {
          if (Env.NODE_ENV === 'development') ph.debug();
        },
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

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
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const userId = session.user.id || session.user.email || '';
      if (userId) {
        posthog.identify(userId, {
          email: session.user.email,
          name: session.user.name,
        });
      }
    } else if (status === 'unauthenticated') {
      posthog.reset();
    }
  }, [status, session]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
