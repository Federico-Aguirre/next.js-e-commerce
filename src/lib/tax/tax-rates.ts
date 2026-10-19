import 'server-only';
import type { TaxCalculationMethod, TaxProfile } from './types';

const TAX_RATES_URL = 'https://vatestimator.com/api/v1/rates.json';
const CACHE_SECONDS = 24 * 60 * 60;
const ARGENTINA_FALLBACK: TaxProfile = {
  countryCode: 'AR',
  countryName: 'Argentina',
  taxName: 'IVA',
  rate: 21,
  calculationMethod: 'tax_exclusive_base',
  status: 'standard',
  dataUpdatedAt: null,
  lastVerified: null,
  officialSourceUrl: 'https://biblioteca.arca.gob.ar/dcp/TOR_C_020631_1997_03_26',
};

type TaxRateRecord = {
  code?: string;
  slug?: string;
  country?: string;
  standard_rate?: number | null;
  calculation_method?: string;
  rates?: Array<{
    rate?: number | null;
    rate_percent?: number | null;
    role?: string;
    tax_type?: string;
  }>;
  official_source_url?: string;
  last_verified?: string;
};

type TaxRateDataset = {
  meta?: {
    last_updated?: string;
    last_verified?: string;
    total_countries?: number;
  };
  rates?: TaxRateRecord[];
};

const COUNTRY_ALIASES: Record<string, string> = {
  AR: 'AR',
  ARGENTINA: 'AR',
  'REPUBLICA ARGENTINA': 'AR',
  BO: 'BO',
  BOLIVIA: 'BO',
  'ESTADO PLURINACIONAL DE BOLIVIA': 'BO',
  BR: 'BR',
  BRAZIL: 'BR',
  BRASIL: 'BR',
  CL: 'CL',
  CHILE: 'CL',
  CO: 'CO',
  COLOMBIA: 'CO',
  EC: 'EC',
  ECUADOR: 'EC',
  GY: 'GY',
  GUYANA: 'GY',
  PE: 'PE',
  PERU: 'PE',
  PY: 'PY',
  PARAGUAY: 'PY',
  SR: 'SR',
  SURINAME: 'SR',
  SURINAM: 'SR',
  UY: 'UY',
  URUGUAY: 'UY',
  VE: 'VE',
  VENEZUELA: 'VE',
  US: 'US',
  USA: 'US',
  EEUU: 'US',
  'ESTADOS UNIDOS': 'US',
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  CA: 'CA',
  CANADA: 'CA',
  CANADA_: 'CA',
  GB: 'GB',
  UK: 'GB',
  'UNITED KINGDOM': 'GB',
  'REINO UNIDO': 'GB',
  ES: 'ES',
  ESPANA: 'ES',
  SPAIN: 'ES',
  DE: 'DE',
  ALEMANIA: 'DE',
  GERMANY: 'DE',
  FR: 'FR',
  FRANCIA: 'FR',
  FRANCE: 'FR',
  IT: 'IT',
  ITALIA: 'IT',
  ITALY: 'IT',
  PT: 'PT',
  PORTUGAL: 'PT',
  NL: 'NL',
  'PAISES BAJOS': 'NL',
  NETHERLANDS: 'NL',
  MX: 'MX',
  MEXICO: 'MX',
  JP: 'JP',
  JAPON: 'JP',
  JAPAN: 'JP',
  CN: 'CN',
  CHINA: 'CN',
  IN: 'IN',
  INDIA: 'IN',
};

function normalizeCountry(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function countryCodeFromInput(countryInput: string): string {
  const normalized = normalizeCountry(countryInput);
  if (COUNTRY_ALIASES[normalized]) return COUNTRY_ALIASES[normalized];
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  return '';
}

async function getTaxDataset(): Promise<TaxRateDataset> {
  const response = await fetch(TAX_RATES_URL, {
    next: { revalidate: CACHE_SECONDS },
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Tax-rate service returned HTTP ${response.status}.`);

  const data = (await response.json()) as TaxRateDataset;
  if (!Array.isArray(data.rates) || data.rates.length === 0) {
    throw new Error('Tax-rate service returned an invalid dataset.');
  }
  return data;
}

function jurisdictionalTaxProfile(
  code: string,
  inputName: string,
  dataUpdatedAt: string | null,
): TaxProfile {
  if (code === 'US') {
    return {
      countryCode: code,
      countryName: 'United States',
      taxName: 'Sales tax',
      rate: null,
      calculationMethod: 'tax_exclusive_base',
      status: 'jurisdictional',
      dataUpdatedAt,
      lastVerified: null,
      officialSourceUrl: 'https://www.usa.gov/sales-tax',
    };
  }

  return {
    countryCode: code,
    countryName: inputName || code,
    taxName: code === 'BR' ? 'ICMS' : 'Tax',
    rate: null,
    calculationMethod: 'tax_exclusive_base',
    status: 'unavailable',
    dataUpdatedAt,
    lastVerified: null,
    officialSourceUrl: null,
  };
}

/**
 * Loads standard VAT/GST rates from the free, attribution-required VATEstimator dataset.
 * Rates are indicative for display/checkouts, not a substitute for a registered tax engine.
 */
export async function getCountryTaxProfile(
  countryInput: string | null | undefined,
): Promise<TaxProfile | null> {
  const inputName = countryInput?.trim() ?? '';
  if (!inputName) return getCountryTaxProfile('AR');

  let code = countryCodeFromInput(inputName);
  let dataset: TaxRateDataset;

  try {
    dataset = await getTaxDataset();
  } catch (error) {
    if (code === 'AR') return ARGENTINA_FALLBACK;
    if (code === 'US' || code === 'BR') return jurisdictionalTaxProfile(code, inputName, null);
    console.error('Unable to refresh country tax rates:', error);
    if (code) return jurisdictionalTaxProfile(code, inputName, null);
    return null;
  }

  const dataUpdatedAt = dataset.meta?.last_updated ?? null;
  const normalizedInput = normalizeCountry(inputName);
  let record = dataset.rates?.find((entry) => {
    if (code && entry.code?.toUpperCase() === code) return true;
    const countryName = entry.country ? normalizeCountry(entry.country) : '';
    const slugName = entry.slug ? normalizeCountry(entry.slug.replace(/-/g, ' ')) : '';
    return countryName === normalizedInput || slugName === normalizedInput;
  });

  // Addresses may store localized country names; the dataset's own names/slugs
  // let us map any of its supported countries without maintaining a giant alias list.
  if (!code && record?.code) code = record.code.toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return null;

  if (!record) {
    if (code === 'AR') return { ...ARGENTINA_FALLBACK, dataUpdatedAt };
    return jurisdictionalTaxProfile(code, inputName, dataUpdatedAt);
  }

  const standardRate = record.standard_rate;
  const normalizedRate =
    typeof standardRate === 'number' && Number.isFinite(standardRate) ? standardRate : null;
  const standardEntry = record.rates?.find((rate) => rate.role === 'standard') ?? record.rates?.[0];
  const countryName = record.country || inputName || code;

  return {
    countryCode: code,
    countryName,
    taxName: standardEntry?.tax_type || (code === 'AR' ? 'IVA' : 'VAT/GST'),
    rate: normalizedRate,
    // Catalogue prices were converted and stored before tax, so always add the tax rate
    // to that pre-tax base. A country's conventional retail pricing method does not redefine it.
    calculationMethod: 'tax_exclusive_base' as TaxCalculationMethod,
    status: normalizedRate === null ? 'jurisdictional' : 'standard',
    dataUpdatedAt,
    lastVerified: record.last_verified ?? null,
    officialSourceUrl: record.official_source_url ?? null,
  };
}
