import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar"; // O donde tengas tu Navbar instalado
import CartSynchronizer from '@/components/CartSynchronizer';
import WishlistSynchronizer from '@/components/WishlistSynchronizer';
import Providers from "@/providers";


// 🌟 Esto obliga a Next.js a tratar a TODAS las páginas de la app como dinámicas,
// desactivando por completo la caché estática de datos en las peticiones.
export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mi Tienda Senior",
  description: "E-Commerce",
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
          <Navbar />
          {children}
          <CartSynchronizer />
          <WishlistSynchronizer />
        </Providers>
      </body>
    </html>
  );
}