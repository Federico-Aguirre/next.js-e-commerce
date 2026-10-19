'use client';

import { SessionProvider } from 'next-auth/react';
import React, { type PropsWithChildren } from 'react';
import type { SupportedCurrency } from '@/lib/currency/currencies';
import type { TaxProfile } from '@/lib/tax/types';
import { CurrencyProvider } from './CurrencyProvider';
import { PostHogProvider } from './PostHogProvider';

type ProvidersProps = PropsWithChildren<{
  initialCurrency: SupportedCurrency;
  initialRates: Record<string, number> | null;
  initialRatesUpdatedAt: string | null;
  initialTaxProfile: TaxProfile | null;
}>;

export default function Providers({
  children,
  initialCurrency,
  initialRates,
  initialRatesUpdatedAt,
  initialTaxProfile,
}: ProvidersProps) {
  return (
    <CurrencyProvider
      initialCurrency={initialCurrency}
      initialRates={initialRates}
      initialRatesUpdatedAt={initialRatesUpdatedAt}
      initialTaxProfile={initialTaxProfile}
    >
      <SessionProvider>
        <PostHogProvider>{children}</PostHogProvider>
      </SessionProvider>
    </CurrencyProvider>
  );
}
