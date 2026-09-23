import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Footer } from '@/components/Footer';
import MotionProvider from '@/components/MotionProvider';
import { routing } from '@/lib/I18nRouting';
import { StoreConfig } from '@/utils/StoreConfig';

export const metadata: Metadata = {
  title: StoreConfig.name,
  icons: '/favicon.ico',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <MotionProvider>
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-0">
          {props.children}
        </main>
        <Footer />
      </MotionProvider>
    </NextIntlClientProvider>
  );
}
