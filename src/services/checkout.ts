/**
 * Direct order creation previously marked orders as PAID without verifying a
 * provider charge. Intentionally disabled: all purchases must use /api/checkout
 * and provider-specific confirmation that validates owner, amount and currency.
 */
export async function processSecureCheckout(): Promise<never> {
  throw new Error('Direct checkout is disabled. Use the payment-backed checkout flow.');
}
