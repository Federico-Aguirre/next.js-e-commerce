import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Suspense } from 'react';
import RequestScopedApp from '@/components/RequestScopedApp';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-nova-sans' });

const themeInitializationScript = `(() => {
  // Keep the document language aligned with the visible localized route.
  document.documentElement.lang = window.location.pathname === '/es' || window.location.pathname.startsWith('/es/') ? 'es' : 'en';
  let theme = 'light';
  try {
    const match = document.cookie.match(/(?:^|;\\s*)nova_theme=(light|dark)(?:;|$)/);
    if (match) theme = match[1];
  } catch {}
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
})();`;

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
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script id="nova-theme-initialization" strategy="beforeInteractive">
          {themeInitializationScript}
        </Script>
      </head>
      <body className={`${inter.variable} font-sans`}>
        <Suspense fallback={<div className="min-h-screen bg-background" aria-hidden="true" />}>
          <RequestScopedApp>{children}</RequestScopedApp>
        </Suspense>
      </body>
    </html>
  );
}
