'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useSession } from 'next-auth/react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only', 
        capture_pageview: true,              
        disable_session_recording: false,    // Fuerza las grabaciones de video en localhost
        loaded: (ph) => {
          if (process.env.NODE_ENV === 'development') ph.debug(); 
        },
      });
    }
  }, []);

  // FUSIÓN DE USUARIO ANÓNIMO A LOGUEADO
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const userId = (session.user as any).id || session.user.email || '';
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