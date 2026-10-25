export type ShippingProvider = 'ZIPNOVA' | 'SHIPPO' | 'LOCAL';

export type ShippingQuote = {
  id: string;
  provider: ShippingProvider;
  carrier: string;
  service: string;
  amount: number;
  currency: string;
  estimatedDeliveryAt: string | null;
  meta: Record<string, string | number | null>;
};

export type ShippingActionResult =
  | { success: true; provider: ShippingProvider; quotes: ShippingQuote[] }
  | { success: false; error: string };

export type CheckoutShippingOption = ShippingQuote & {
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  taxCalculationMethod: string;
  taxName: string;
  taxCountry: string;
  productTotal: number;
  shippingAmount: number;
  totalInStoreCurrency: number;
  paymentShippingAmount: number;
  paymentTotal: number;
  paymentCurrency: 'ARS' | 'USD';
  paymentExchangeRate: number;
  storeCurrency: string;
  quoteToken: string;
};

export type CheckoutShippingSelection = Pick<
  CheckoutShippingOption,
  | 'id'
  | 'provider'
  | 'carrier'
  | 'service'
  | 'amount'
  | 'currency'
  | 'paymentTotal'
  | 'paymentCurrency'
>;
