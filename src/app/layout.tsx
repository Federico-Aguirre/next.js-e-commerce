import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import AnalyticsConsentBanner from '@/components/AnalyticsConsentBanner';
import CartSynchronizer from '@/components/CartSynchronizer';
import CatalogPriceSynchronizer from '@/components/CatalogPriceSynchronizer';
import './globals.css';
import DatabaseGuard from '@/components/DatabaseGuard';
import { Header } from '@/components/Header';
import WishlistSynchronizer from '@/components/WishlistSynchronizer';
import { resolveDisplayCurrency } from '@/lib/currency/currencies';
import { getLatestUsdExchangeRates } from '@/lib/currency/exchange-rates';
import { getCountryTaxProfile } from '@/lib/tax/tax-rates';
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const countryCode =
    requestHeaders.get('x-vercel-ip-country') ??
    requestHeaders.get('cf-ipcountry') ??
    requestHeaders.get('cloudfront-viewer-country') ??
    requestHeaders.get('x-country-code');
  const detectedCountryCode = countryCode?.trim().toUpperCase();
  const hasDetectedCountry =
    Boolean(detectedCountryCode) &&
    /^[A-Z]{2}$/.test(detectedCountryCode!) &&
    detectedCountryCode !== 'XX';
  // Keep local development convenient for testing from Argentina. In production,
  // only an explicit AR country code should trigger ARS/Argentine tax presentation.
  const normalizedCountryCode = hasDetectedCountry
    ? detectedCountryCode!
    : process.env.NODE_ENV === 'development'
      ? 'AR'
      : 'XX';
  const initialCurrency = resolveDisplayCurrency(normalizedCountryCode);
  let initialTaxProfile = null;
  try {
    initialTaxProfile = await getCountryTaxProfile(normalizedCountryCode);
  } catch (error) {
    console.error('Initial country tax rate unavailable:', error);
  }

  let initialRates: Record<string, number> | null = null;
  let initialRatesUpdatedAt: string | null = null;

  try {
    const quote = await getLatestUsdExchangeRates();
    if (Number.isFinite(quote.rates.ARS) && quote.rates.ARS > 0) {
      initialRates = { USD: 1, ARS: quote.rates.ARS };
      initialRatesUpdatedAt = quote.updatedAt;
    }
  } catch (error) {
    console.error('Initial USD/ARS reference rate unavailable:', error);
  }

  return (
    <html lang="es">
      <body className={inter.className}>
        {/* Envolvemos todo adentro de Providers */}
        <Providers
          initialCurrency={initialCurrency}
          initialRates={initialRates}
          initialRatesUpdatedAt={initialRatesUpdatedAt}
          initialTaxProfile={initialTaxProfile}
        >
          <NextIntlClientProvider locale="es" messages={messages}>
            <Header />
            <AnalyticsConsentBanner />
            <DatabaseGuard>{children}</DatabaseGuard>
            <CartSynchronizer />
            <WishlistSynchronizer />
            <CatalogPriceSynchronizer />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
