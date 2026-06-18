'use client';

import React from 'react';

export default function CatalogSkeleton() {
  // Array de 4 elementos para dibujar 4 tarjetas falsas en la grilla
  const esqueletoTarjetas = Array.from({ length: 4 });

  return (
    <div className="w-full">
      {/* 🔍 Esqueleto falso para la barra de búsqueda */}
      <div className="max-w-md mx-auto mb-10">
        <div className="h-12 w-full bg-gray-200 rounded-xl animate-pulse" />
      </div>

      {/* 📦 Grilla de tarjetas falsas */}
      <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-4 xl:gap-x-8">
        {esqueletoTarjetas.map((_, index) => (
          <div 
            key={index} 
            className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm h-[480px] flex flex-col justify-between p-5"
          >
            {/* Contenedor de la foto falsa */}
            <div className="w-full h-72 bg-gray-100 rounded-lg animate-pulse" />
            
            {/* Textos falsos */}
            <div className="space-y-3 mt-4 flex-1">
              {/* Título linea 1 */}
              <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
              {/* Título linea 2 */}
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
              {/* Categoría */}
              <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3 mt-2" />
            </div>

            {/* Precio y botón falsos */}
            <div className="mt-5 flex items-center justify-between">
              {/* Precio */}
              <div className="h-6 bg-gray-200 rounded animate-pulse w-1/4" />
              {/* Botón */}
              <div className="h-8 bg-gray-200 rounded-lg animate-pulse w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}