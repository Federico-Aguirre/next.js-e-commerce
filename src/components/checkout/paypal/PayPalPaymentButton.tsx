'use client';

import { Button } from '@/components/ui/button';

type PayPalPaymentButtonProps = {
  amount: number;
  loading: boolean;
  formLoading: boolean;
  ready: boolean;
  onClick: () => void;
};

export default function PayPalPaymentButton({
  amount,
  loading,
  formLoading,
  ready,
  onClick,
}: PayPalPaymentButtonProps) {
  return (
    <Button
      type="button"
      variant="paypal"
      size="lg"
      disabled={loading || formLoading || !ready}
      onClick={onClick}
      className="w-full"
    >
      {loading
        ? 'Procesando...'
        : formLoading
          ? 'Cargando formulario...'
          : `Pagar ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'code' }).format(amount)}`}
    </Button>
  );
}
