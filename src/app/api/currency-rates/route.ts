import { NextResponse } from 'next/server';
import { CURRENCIES, SUPPORTED_CURRENCY_CODES } from '@/lib/currency/currencies';
import { getLatestUsdExchangeRates } from '@/lib/currency/exchange-rates';

export const revalidate = 86400;

export async function GET() {
  try {
    const data = await getLatestUsdExchangeRates();
    const rates = Object.fromEntries(
      SUPPORTED_CURRENCY_CODES.map((code) => [code, data.rates[code]]),
    );

    const missingCurrencies = CURRENCIES.filter(
      (currency) => !Number.isFinite(rates[currency.code]) || rates[currency.code] <= 0,
    ).map((currency) => currency.code);

    if (missingCurrencies.length > 0) {
      throw new Error(`Exchange rates unavailable for: ${missingCurrencies.join(', ')}.`);
    }

    return NextResponse.json(
      {
        base: data.baseCode,
        rates,
        updatedAt: data.updatedAt,
        nextUpdateAt: data.nextUpdateAt,
        provider: 'ExchangeRate-API',
        attributionUrl: 'https://www.exchangerate-api.com',
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
        },
      },
    );
  } catch (error) {
    console.error('Unable to load currency reference rates:', error);
    return NextResponse.json(
      { error: 'Currency reference rates are temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
