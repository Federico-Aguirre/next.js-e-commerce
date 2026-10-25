'use client';

import { useSession, signOut } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import React from 'react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/useCartStore';

function CartCounter() {
  const cartCount = useCartStore((state) => state.getCartCount());
  if (cartCount === 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm shadow-primary/30">
      {cartCount}
    </span>
  );
}

const DynamicCartCounter = dynamic(() => Promise.resolve(CartCounter), {
  ssr: false,
});

export default function Navbar() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const user = session?.user;

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 bg-card shadow-sm backdrop-blur-md">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* LOGO */}
          <div className="flex shrink-0 items-center">
            <Link
              href="/"
              className="text-xl font-black tracking-tight text-foreground transition-colors hover:text-primary"
            >
              NOVA<span className="text-primary">STORE</span>
            </Link>
          </div>

          {/* NAVEGACIÓN DERECHA */}
          <div className="flex items-center gap-x-6">
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Catálogo
            </Link>

            {/* ❤️ CORREGIDO: Apunta a /favoritos en español como tu archivo */}
            <Link
              href="/favorites"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              title="Mis Favoritos"
            >
              Lista de deseos
            </Link>

            {/* 🛍️ UBICACIÓN PREMIUM: "Mis Compras" aparece integrado de forma natural */}
            <Link
              href="/historial"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Mis Compras
            </Link>

            {/* BOTÓN DEL CARRITO */}
            <Link
              href="/cart"
              className="group relative -m-2 flex items-center p-2"
              aria-label="Ver carrito"
            >
              <svg
                className="h-6 w-6 shrink-0 text-muted-foreground transition-colors group-hover:text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <DynamicCartCounter />
            </Link>

            {/* Separador visual */}
            <span className="h-4 w-px bg-muted" aria-hidden="true" />

            {/* BLOQUE DE AUTH DINÁMICO */}
            {isLoading ? (
              <span className="text-xs text-muted-foreground">...</span>
            ) : user ? (
              /* Estado: USUARIO LOGUEADO */
              <div className="flex items-center gap-x-5">
                <span className="text-sm font-semibold text-foreground">
                  Hola{' '}
                  <span className="text-primary">{user.name?.split(' ')[0] || 'Comprador'}</span>
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs font-bold text-destructive transition-colors hover:text-destructive"
                >
                  Salir
                </Button>
              </div>
            ) : (
              /* Estado: USUARIO INVITADO (No logueado) */
              <div className="flex items-center gap-x-4">
                <Link
                  href="/login"
                  className="text-sm font-bold text-foreground transition-colors hover:text-primary"
                >
                  Ingresar
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
