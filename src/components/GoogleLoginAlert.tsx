'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function AlertHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Si en la URL detectamos que volvió de Google con éxito
    if (searchParams.get('login') === 'success') {
      alert('¡Inicio de sesión con Google exitoso!');
      router.replace('/'); // Limpia la URL para que quede bonita
    }
  }, [searchParams, router]);

  return null; // Este componente no dibuja nada en pantalla, es pura lógica
}

export default function GoogleLoginAlert() {
  return (
    <Suspense fallback={null}>
      <AlertHandler />
    </Suspense>
  );
}