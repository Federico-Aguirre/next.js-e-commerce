import type { CartItem } from '@/store/useCartStore';

export type { CartItem };

export type SavedPayPalCard = {
  id: string;
  brand: string;
  lastFourDigits: string | null;
  expirationMonth: number | null;
  expirationYear: number | null;
};

export type PayPalCardFormProps = {
  cartItems: CartItem[];
  onSuccess: () => void;
  shippingQuoteToken: string | null;
  paymentTotal: number | null;
  deliveryAddressId?: string | null;
  onPaymentBusyChange?: (busy: boolean) => void;
};

export type PayPalCardSession = {
  createCardFieldsComponent: (options: {
    type: 'number' | 'expiry' | 'cvv';
    placeholder: string;
  }) => Node;

  submit: (
    orderId: string,
    options?: {
      billingAddress?: {
        streetAddress?: string;
        city?: string;
        state?: string;
        countryCode?: string;
        postalCode?: string;
      };
    },
  ) => Promise<{
    state: 'succeeded' | 'canceled' | 'failed' | string;
    data?: {
      orderId?: string;
      message?: string;
      liabilityShift?: string;
    };
  }>;
};

export type PayPalSDK = {
  findEligibleMethods: (options?: { currencyCode?: string }) => Promise<{
    isEligible: (method: string) => boolean;
  }>;

  createCardFieldsOneTimePaymentSession: () => PayPalCardSession;
};
