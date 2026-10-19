export type TaxCalculationMethod = 'tax_exclusive_base' | 'tax_inclusive_base';

export type TaxProfile = {
  countryCode: string;
  countryName: string;
  taxName: string;
  /** Standard national VAT/GST rate; null when the rate depends on state/local address or is unavailable. */
  rate: number | null;
  calculationMethod: TaxCalculationMethod;
  status: 'standard' | 'jurisdictional' | 'unavailable';
  dataUpdatedAt: string | null;
  lastVerified: string | null;
  officialSourceUrl: string | null;
};
