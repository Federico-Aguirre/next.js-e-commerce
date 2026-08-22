'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

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
    <div className="max-w-md mx-auto mb-10 relative">
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar productos por nombre..."
          value={texto}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full h-12 pl-12 pr-4 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-gray-800"
        />
        
        {/* Icono de Lupa */}
        <div className="absolute left-4 top-3.5 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
          </svg>
        </div>

        {/* Botón para limpiar (X) */}
        {texto && (
          <button
            type="button"
            onClick={() => handleSearch('')}
            className="absolute right-4 top-3 text-gray-400 hover:text-gray-600 text-xs font-bold bg-gray-100 hover:bg-gray-200 w-6 h-6 rounded-full transition-colors cursor-pointer flex items-center justify-center"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}