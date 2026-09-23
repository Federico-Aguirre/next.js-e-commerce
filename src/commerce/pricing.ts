import type { Cart, CurrencyCode, Money, TaxLine } from './contracts';

const assertCurrency = (
  values: readonly Money[],
  fallbackCurrency?: string,
) => {
  const currency = (values[0]?.currency ?? fallbackCurrency)
    ?.trim()
    .toUpperCase();

  if (
    !currency ||
    values.some((value) => value.currency.trim().toUpperCase() !== currency)
  ) {
    throw new Error('All monetary values must use the same currency');
  }

  if (
    values.some((value) => !Number.isFinite(value.amount) || value.amount < 0)
  ) {
    throw new Error('Monetary amounts must be non-negative finite numbers');
  }

  return currency;
};

export const sumMoney = (values: readonly Money[]): Money => {
  if (values.length === 0) {
    throw new Error('At least one monetary value is required');
  }

  return {
    amount: values.reduce((total, value) => total + value.amount, 0),
    currency: assertCurrency(values),
  };
};

export const calculateCartSubtotal = (cart: Cart): Money => {
  if (
    cart.lines.some(
      (line) => !Number.isInteger(line.quantity) || line.quantity <= 0,
    )
  ) {
    throw new Error('Cart quantities must be positive integers');
  }

  assertCurrency(
    cart.lines.map((line) => line.unitPrice),
    cart.currency,
  );

  return {
    amount: cart.lines.reduce(
      (total, line) => total + line.unitPrice.amount * line.quantity,
      0,
    ),
    currency: cart.currency,
  };
};

export const calculateTaxTotal = (
  taxLines: readonly TaxLine[],
  currency?: CurrencyCode,
): Money => {
  if (!currency) {
    throw new Error('Currency is required');
  }

  if (taxLines.length === 0) {
    return { amount: 0, currency };
  }

  return sumMoney(taxLines.map((line) => line.amount));
};

export const calculateOrderTotal = ({
  subtotal,
  shipping,
  tax,
  discount,
}: {
  subtotal: Money;
  shipping: Money;
  tax: Money;
  discount: Money;
}): Money => {
  const currency = assertCurrency([subtotal, shipping, tax, discount]);
  const amount =
    subtotal.amount + shipping.amount + tax.amount - discount.amount;

  if (amount < 0) {
    throw new Error('Order total cannot be negative');
  }

  return { amount, currency };
};
