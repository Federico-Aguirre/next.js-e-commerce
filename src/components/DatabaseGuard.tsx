'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function DatabaseGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'LOADING' | 'WAKING_UP' | 'READY'>('LOADING');
  const router = useRouter();
  const wasWakingUp = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timeout | undefined;

    const checkStatus = async () => {
      try {
        const response = await fetch('/api/aiven-status', { cache: 'no-store' });

        // The endpoint only authorizes the platform owner. Public visitors should
        // render the storefront normally and must never trigger infrastructure wake-up.
        if (response.status === 401 || response.status === 403) {
          if (isMounted) setStatus('READY');
          return;
        }

        if (!response.ok) {
          if (isMounted) setStatus('READY');
          return;
        }

        const data = (await response.json()) as { status?: string };

        if (data.status === 'READY') {
          if (isMounted) {
            if (wasWakingUp.current) router.refresh();
            setStatus('READY');
          }
          return;
        }

        if (data.status === 'SLEEPING' && !wasWakingUp.current) {
          const wakeResponse = await fetch('/api/aiven-status', {
            method: 'POST',
            cache: 'no-store',
          });

          if (!wakeResponse.ok) {
            if (isMounted) setStatus('READY');
            return;
          }

          const wakeResult = (await wakeResponse.json()) as { status?: string };
          if (wakeResult.status === 'READY') {
            if (isMounted) {
              router.refresh();
              setStatus('READY');
            }
            return;
          }
        }

        if (data.status === 'SLEEPING' || data.status === 'WAKING_UP') {
          if (isMounted) {
            wasWakingUp.current = true;
            setStatus('WAKING_UP');
            timer = setTimeout(checkStatus, 5000);
          }
          return;
        }

        if (isMounted) setStatus('READY');
      } catch (error) {
        console.error('Error comprobando el estado de Aiven:', error);
        if (isMounted) setStatus('READY');
      }
    };

    void checkStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  if (status === 'READY') {
    return <>{children}</>;
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1>Conectando con la base de datos...</h1>
      <p role="status" aria-live="polite">
        El propietario de la plataforma puede iniciar el servicio desde una sesión autorizada.
      </p>
    </main>
  );
}
