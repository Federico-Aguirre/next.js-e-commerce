'use client';

type PayPalPaymentButtonProps = {
  amount: number;
  loading: boolean;
  ready: boolean;
  onClick: () => void;
};

export default function PayPalPaymentButton({
  amount,
  loading,
  ready,
  onClick,
}: PayPalPaymentButtonProps) {
  return (
    <button
      type="button"
      disabled={loading || !ready}
      onClick={onClick}
      className="w-full rounded-lg bg-[#0070ba] px-4 py-3 text-base font-bold text-white transition-colors hover:bg-[#005ea8] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? 'Procesando...' : `Pagar $${amount.toFixed(2)}`}
    </button>
  );
}
