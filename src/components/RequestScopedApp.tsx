import 'server-only';
import { NextIntlClientProvider } from 'next-intl';
import { headers } from 'next/headers';
import AnalyticsConsentBanner from '@/components/AnalyticsConsentBanner';
import CartSynchronizer from '@/components/CartSynchronizer';
import CatalogPriceSynchronizer from '@/components/CatalogPriceSynchronizer';
import DatabaseGuard from '@/components/DatabaseGuard';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';
import StorefrontClosedPage from '@/components/StorefrontClosedPage';
import WishlistSynchronizer from '@/components/WishlistSynchronizer';
import { resolveDisplayCurrency } from '@/lib/currency/currencies';
import { getLatestUsdExchangeRates } from '@/lib/currency/exchange-rates';
import {
  canAccessWhileStoreClosed,
  resolveStorefrontLocale,
} from '@/lib/storefront/closure-policy';
import { getStorefrontStatus } from '@/lib/storefront/storefront-status';
import { getCountryTaxProfile } from '@/lib/tax/tax-rates';
import messages from '@/locales/es.json';
import Providers from '@/providers';

export default async function RequestScopedApp({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Request-dependent data stays inside the Suspense boundary in the root layout.
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-nova-pathname') ?? '';
  if (!canAccessWhileStoreClosed(pathname)) {
    let storefrontMode: 'OPEN' | 'CLOSED' | 'UNAVAILABLE' = 'OPEN';
    try {
      storefrontMode = (await getStorefrontStatus()) === 'OPEN' ? 'OPEN' : 'CLOSED';
    } catch (error) {
      console.error(
        'Could not verify storefront availability:',
        error instanceof Error ? error.name : 'UnknownError',
      );
      storefrontMode = 'UNAVAILABLE';
    }
    if (storefrontMode !== 'OPEN') {
      return (
        <StorefrontClosedPage
          locale={resolveStorefrontLocale(pathname, requestHeaders.get('cookie'))}
          mode={storefrontMode}
        />
      );
    }
  }

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
    <Providers
      initialCurrency={initialCurrency}
      initialRates={initialRates}
      initialRatesUpdatedAt={initialRatesUpdatedAt}
      initialTaxProfile={initialTaxProfile}
    >
      <NextIntlClientProvider locale="es" messages={messages}>
        <SkipLink />
        <Header />
        <AnalyticsConsentBanner />
        <DatabaseGuard>{children}</DatabaseGuard>
        <CartSynchronizer />
        <WishlistSynchronizer />
        <CatalogPriceSynchronizer />
      </NextIntlClientProvider>
    </Providers>
  );
}
