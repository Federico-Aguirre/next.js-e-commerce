'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { AuthRequiredNotice } from '@/components/checkout/AuthRequiredNotice';
import DeliveryAddressSummary from '@/components/checkout/DeliveryAddressSummary';
import CheckoutForm from '@/components/checkout/mercado-pago/CheckoutForm';
import TestCardButton from '@/components/checkout/mercado-pago/TestCardButton';
import OrderSummary from '@/components/checkout/OrderSummary';
import { useDirectCardCheckout } from '@/hooks/useDirectCardCheckout';

export default function DirectCardCheckoutPage() {
  const { data: session, status } = useSession();
  const [secureOriginReady, setSecureOriginReady] = useState(false);
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

  useEffect(() => {
    if (window.location.protocol === 'https:') {
      setSecureOriginReady(true);
      return;
    }

    const secureSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!secureSiteUrl?.startsWith('https://')) return;

    const target = new URL(secureSiteUrl);
    target.pathname = window.location.pathname;
    target.search = window.location.search;
    window.location.replace(target.toString());
  }, []);

  if (!secureOriginReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <p className="text-sm font-medium text-gray-600">Redirigiendo al checkout seguro...</p>
      </div>
    );
  }

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

        <OrderSummary cartItems={cartItems} />

        <TestCardButton onClick={handleAutofill} />

        <CheckoutForm
          formData={formData}
          formErrors={formErrors}
          loading={loading}
          cartIsEmpty={cartItems.length === 0}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />

        <DeliveryAddressSummary />
      </div>
    </div>
  );
}
