import type { Money } from './contracts';

export type Promotion = {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  currency?: string;
  startsAt?: string;
  endsAt?: string;
  maxRedemptions?: number;
};

export type PromotionApplication = {
  promotionId: string;
  discount: Money;
};

export type PromotionRepository = {
  findByCode: (code: string) => Promise<Promotion | null>;
};

export const calculatePromotionDiscount = (
  promotion: Promotion,
  subtotal: Money,
): PromotionApplication => {
  const normalizedCurrency = subtotal.currency.trim().toUpperCase();
  if (!Number.isFinite(subtotal.amount) || subtotal.amount < 0) {
    throw new Error('Promotion subtotal must be a non-negative finite number');
  }

  if (
    promotion.currency &&
    promotion.currency.toUpperCase() !== normalizedCurrency
  ) {
    throw new Error('Promotion currency does not match the cart currency');
  }

  if (!Number.isFinite(promotion.value) || promotion.value < 0) {
    throw new Error('Promotion value must be a non-negative finite number');
  }

  const rawDiscount =
    promotion.type === 'percentage'
      ? (subtotal.amount * Math.min(promotion.value, 100)) / 100
      : promotion.value;
  const amount = Math.min(subtotal.amount, rawDiscount);

  return {
    promotionId: promotion.id,
    discount: {
      amount,
      currency: normalizedCurrency,
    },
  };
};
