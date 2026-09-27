'use client';

import { BetterStackWebVitals } from '@logtail/next/webVitals';
import { posthog } from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect, useRef } from 'react';
import { Env } from '@/lib/Env';

const isProduction = process.env.NODE_ENV === 'production';

export function ProductionMonitoring(props: { children: React.ReactElement }): React.JSX.Element {
  const initialized = useRef(false);

  useEffect(() => {
    if (!isProduction || initialized.current || !Env.NEXT_PUBLIC_POSTHOG_KEY) {
      return;
    }

    posthog.init(Env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: Env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: true,
      person_profiles: 'identified_only',
      session_recording: {},
    });

    initialized.current = true;
  }, []);

  if (!isProduction) {
    return props.children;
  }

  const content = Env.NEXT_PUBLIC_POSTHOG_KEY ? (
    <PostHogProvider client={posthog}>{props.children}</PostHogProvider>
  ) : (
    props.children
  );

  if (Env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN && Env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL) {
    return (
      <>
        {content}
        <BetterStackWebVitals />
      </>
    );
  }

  return content;
}
