type OrderSummaryProps = {
  cartTotal: number;
};

export default function OrderSummary({ cartTotal }: OrderSummaryProps) {
  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-4 text-base font-bold text-gray-900">Order Summary</h3>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-600">
          Total Amount:
        </span>

        <span className="text-xl font-extrabold text-gray-900">
          ${cartTotal.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
