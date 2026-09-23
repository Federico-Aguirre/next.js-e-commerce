import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { Inter } from 'next/font/google';

import CartSynchronizer from '@/components/CartSynchronizer';

import './globals.css';
import DatabaseGuard from '@/components/DatabaseGuard';
import { Header } from '@/components/Header';
import WishlistSynchronizer from '@/components/WishlistSynchronizer';
import messages from '@/locales/es.json';
import Providers from '@/providers';

// 🌟 Esto obliga a Next.js a tratar a TODAS las páginas de la app como dinámicas,
// desactivando por completo la caché estática de datos en las peticiones.
export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mi Tienda Nova',
  description: 'E-Commerce',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {/* Envolvemos todo adentro de Providers */}
        <Providers>
          <NextIntlClientProvider locale="es" messages={messages}>
            <Header />
            <DatabaseGuard>{children}</DatabaseGuard>
            <CartSynchronizer />
            <WishlistSynchronizer />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
