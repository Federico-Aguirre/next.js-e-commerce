'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSession, signOut } from 'next-auth/react'; 
import { useCartStore } from '@/store/useCartStore';

function CartCounter() {
  const cartCount = useCartStore((state) => state.getCartCount());
  if (cartCount === 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm shadow-indigo-600/30">
      {cartCount}
    </span>
  );
}

const DynamicCartCounter = dynamic(() => Promise.resolve(CartCounter), { ssr: false });

export default function Navbar() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const user = session?.user;

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-white/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* LOGO */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="text-xl font-black tracking-tight text-gray-900 hover:text-indigo-600 transition-colors">
              SENIOR<span className="text-indigo-600">STORE</span>
            </Link>
          </div>

          {/* NAVEGACIÓN DERECHA */}
          <div className="flex items-center gap-x-6">
            <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
              Catálogo
            </Link>
            
            {/* ❤️ CORREGIDO: Apunta a /favoritos en español como tu archivo */}
            <Link href="/favorites" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors" title="Mis Favoritos">
              Lista de deseos
            </Link>

            {/* 🛍️ UBICACIÓN PREMIUM: "Mis Compras" aparece integrado de forma natural */}
            <Link 
              href="/historial" 
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Mis Compras
            </Link>

            {/* BOTÓN DEL CARRITO */}
            <Link href="/checkout" className="group -m-2 p-2 flex items-center relative" aria-label="Ver carrito">
              <svg className="flex-shrink-0 h-6 w-6 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <DynamicCartCounter />
            </Link>

            {/* Separador visual */}
            <span className="h-4 w-px bg-gray-200" aria-hidden="true" />

            {/* BLOQUE DE AUTH DINÁMICO */}
            {isLoading ? (
              <span className="text-xs text-gray-400">...</span>
            ) : user ? (
              /* Estado: USUARIO LOGUEADO */
              <div className="flex items-center gap-x-5">
                <span className="text-sm font-semibold text-gray-700">
                  Hola <span className="text-indigo-600">{user.name?.split(' ')[0] || 'Comprador'}</span>
                </span>

                <button
                  onClick={handleLogout}
                  className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors bg-red-50 px-2.5 py-1.5 rounded-md"
                >
                  Salir
                </button>
              </div>
            ) : (
              /* Estado: USUARIO INVITADO (No logueado) */
              <div className="flex items-center gap-x-4">
                <Link
                  href="/login"
                  className="text-sm font-bold text-gray-700 hover:text-indigo-600 transition-colors"
                >
                  Ingresar
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}