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
