import type { CartItem } from '@/store/useCartStore';

export type { CartItem };

export type PayPalCardFormProps = {
  amount: number;
  cartItems: CartItem[];
  onSuccess: () => void;
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
        addressLine1?: string;
        addressLine2?: string;
        adminArea1?: string;
        adminArea2?: string;
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
