'use client';

import { useSession } from 'next-auth/react';

import { AuthRequiredNotice } from '@/components/checkout/AuthRequiredNotice';
import CheckoutForm from '@/components/checkout/mercado-pago/CheckoutForm';
import TestCardButton from '@/components/checkout/mercado-pago/TestCardButton';
import OrderSummary from '@/components/checkout/OrderSummary';
import { useDirectCardCheckout } from '@/hooks/useDirectCardCheckout';

export default function DirectCardCheckoutPage() {
  const { data: session, status } = useSession();
  const {
    cartItems,
    cartTotal,
    formData,
    formErrors,
    loading,
    handleAutofill,
    handleChange,
    handleSubmit,
  } = useDirectCardCheckout();

  if (status === 'loading') {
    return <div className="p-8 text-center">Cargando...</div>;
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <AuthRequiredNotice />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="mb-5 text-center text-xl font-bold text-gray-900">
          Pago Directo con Tarjeta
        </h2>

        <OrderSummary cartTotal={cartTotal} />

        <TestCardButton onClick={handleAutofill} />

        <CheckoutForm
          formData={formData}
          formErrors={formErrors}
          loading={loading}
          cartIsEmpty={cartItems.length === 0}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
