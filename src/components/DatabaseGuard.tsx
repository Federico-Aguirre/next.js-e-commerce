// src/components/DatabaseGuard.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DatabaseGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'LOADING' | 'WAKING_UP' | 'READY'>('LOADING');
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/aiven-status');
        if (!res.ok) {
          if (isMounted) setStatus('READY');
          return;
        }

        const data = await res.json();

        if (data.status === 'READY') {
          if (isMounted) {
            // Si veníamos de estar en espera/encendido, refrescamos la ruta de forma segura
            setStatus((prevStatus) => {
              if (prevStatus === 'WAKING_UP' || prevStatus === 'LOADING') {
                setTimeout(() => router.refresh(), 0);
              }
              return 'READY';
            });
          }
        } else {
          if (isMounted) setStatus('WAKING_UP');
          // Reintentar en 5 segundos mientras siga iniciando
          timer = setTimeout(checkStatus, 5000);
        }
      } catch (err) {
        console.error('Error comprobando estado Aiven:', err);
        if (isMounted) setStatus('READY');
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  if (status === 'READY') {
    return <>{children}</>;
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh', 
      fontFamily: 'system-ui, sans-serif' 
    }}>
      <h2>Conectando con la base de datos...</h2>
      <p>El servidor de Aiven se está preparando. Por favor, aguarda unos segundos.</p>
    </div>
  );
}