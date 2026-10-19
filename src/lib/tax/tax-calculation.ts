import { roundCurrencyAmount } from '@/lib/currency/currencies';
import type { TaxCalculationMethod } from './types';

export type TaxBreakdown = {
  subtotal: number;
  taxAmount: number;
  total: number;
};

export type TaxableLine = {
  price: number;
  quantity: number;
};

/** Product.price is the fixed catalogue price before tax. */
export function calculateTaxBreakdown(
  netAmount: number,
  taxRate: number | null | undefined,
  currency: string,
  calculationMethod: TaxCalculationMethod = 'tax_exclusive_base',
): TaxBreakdown {
  if (!Number.isFinite(netAmount) || netAmount < 0) {
    throw new Error('The pre-tax amount must be a non-negative finite number.');
  }
  const rate = taxRate ?? 0;
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error('The tax rate must be a percentage between 0 and 100.');
  }

  if (calculationMethod === 'tax_inclusive_base' && rate >= 100) {
    throw new Error('An inclusive tax rate must be lower than 100%.');
  }

  const subtotal = roundCurrencyAmount(netAmount, currency);
  const total = roundCurrencyAmount(
    calculationMethod === 'tax_inclusive_base' && rate > 0
      ? subtotal / (1 - rate / 100)
      : subtotal * (1 + rate / 100),
    currency,
  );
  const taxAmount = roundCurrencyAmount(total - subtotal, currency);

  return { subtotal, taxAmount, total };
}

/** Round tax per item unit so the displayed line totals match payment-gateway line items. */
export function calculateBasketTax(
  lines: readonly TaxableLine[],
  taxRate: number | null | undefined,
  currency: string,
  calculationMethod: TaxCalculationMethod = 'tax_exclusive_base',
): TaxBreakdown {
  let subtotal = 0;
  let total = 0;

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 0) {
      throw new Error('Item quantity must be a non-negative integer.');
    }
    const unit = calculateTaxBreakdown(line.price, taxRate, currency, calculationMethod);
    subtotal += unit.subtotal * line.quantity;
    total += unit.total * line.quantity;
  }

  subtotal = roundCurrencyAmount(subtotal, currency);
  total = roundCurrencyAmount(total, currency);

  return {
    subtotal,
    taxAmount: roundCurrencyAmount(total - subtotal, currency),
    total,
  };
}
