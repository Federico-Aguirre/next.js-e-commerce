'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. Leemos el valor inicial de la URL una sola vez al montar
  const queryInicial = searchParams.get('search') || '';

  // 2. Manejamos un único estado local para que el input sea fluido al tipear
  const [texto, setTexto] = useState(queryInicial);

  // 3. Modificamos la URL directamente cuando el usuario tipea
  const handleSearch = (valor: string) => {
    setTexto(valor);

    const params = new URLSearchParams(searchParams.toString());
    if (valor) {
      params.set('search', valor);
    } else {
      params.delete('search');
    }

    // router.replace actualiza los query params de forma asíncrona en Next.js
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="relative mx-auto mb-10 max-w-md">
      <div className="relative">
        <Input
          type="text"
          placeholder="Buscar productos por nombre..."
          value={texto}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-card pr-4 pl-12 text-sm text-foreground shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        />

        {/* Icono de Lupa */}
        <div className="absolute top-3.5 left-4 text-muted-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z"
            />
          </svg>
        </div>

        {/* Botón para limpiar (X) */}
        {texto && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => handleSearch('')}
            className="absolute top-3 right-4 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground"
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}
