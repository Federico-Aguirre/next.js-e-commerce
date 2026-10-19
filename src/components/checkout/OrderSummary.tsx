'use client';

import { TaxInclusivePrice } from '@/components/TaxInclusivePrice';
import { calculateBasketTax } from '@/lib/tax/tax-calculation';
import { useCurrency } from '@/providers/CurrencyProvider';
import type { CartItem } from '@/store/useCartStore';
import { StoreConfig } from '@/utils/StoreConfig';

type OrderSummaryProps = {
  cartItems: CartItem[];
};

export default function OrderSummary({ cartItems }: OrderSummaryProps) {
  const { currency, taxProfile } = useCurrency();
  const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const totals = calculateBasketTax(
    cartItems.map(({ price, quantity }) => ({ price, quantity })),
    taxProfile?.rate,
    StoreConfig.currency,
    taxProfile?.calculationMethod,
  );

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-4 text-base font-bold text-gray-900">Resumen de compra</h3>
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm font-semibold text-gray-600">
          {currency === 'ARS' ? 'Total:' : 'Precio base:'}
        </span>
        <TaxInclusivePrice
          amount={subtotal}
          grossAmountOverride={totals.total}
          locale={currency === 'ARS' ? 'es-AR' : 'en-US'}
          compact={false}
          className="text-xl font-extrabold text-gray-900"
        />
      </div>
    </div>
  );
}
