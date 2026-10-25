'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { AuthRequiredNotice } from '@/components/checkout/AuthRequiredNotice';
import CheckoutShippingSummary from '@/components/checkout/CheckoutShippingSummary';
import DeliveryAddressSummary from '@/components/checkout/DeliveryAddressSummary';
import MercadoPagoCardForm from '@/components/checkout/mercado-pago/MercadoPagoCardForm';
import { useCheckoutShipping } from '@/components/checkout/useCheckoutShipping';
import { useCartStore } from '@/store/useCartStore';

export default function DirectCardCheckoutPage() {
  const { data: session, status } = useSession();
  const cartItems = useCartStore((state) => state.cart);
  const [secureOriginReady, setSecureOriginReady] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [deliveryAddressId, setDeliveryAddressId] = useState<string | null>(null);
  const [deliveryAddressesLoaded, setDeliveryAddressesLoaded] = useState(false);
  const handleAddressesLoaded = useCallback((id: string | null) => {
    setDeliveryAddressId(id);
    setDeliveryAddressesLoaded(true);
  }, []);
  const handleSelectedAddressChange = useCallback((id: string) => {
    setDeliveryAddressId(id);
  }, []);
  const shipping = useCheckoutShipping(
    cartItems,
    'ARS',
    status === 'authenticated' &&
      secureOriginReady &&
      deliveryAddressesLoaded &&
      Boolean(deliveryAddressId),
    deliveryAddressId,
  );

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
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen items-center justify-center bg-muted/40 px-4"
      >
        <h1 className="sr-only">Checkout seguro</h1>
        <p role="status" aria-live="polite" className="text-sm font-medium text-muted-foreground">
          Redirigiendo al checkout seguro...
        </p>
      </main>
    );
  }

  if (status === 'loading') {
    return (
      <main id="main-content" tabIndex={-1} className="p-8 text-center">
        <h1 className="sr-only">Preparando el pago</h1>
        <p role="status" aria-live="polite">
          Cargando...
        </p>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10"
      >
        <AuthRequiredNotice />
      </main>
    );
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10"
    >
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-5 text-center text-xl font-bold text-foreground">
          Pago seguro con tarjeta
        </h1>

        <DeliveryAddressSummary
          selectedAddressId={deliveryAddressId}
          onSelectedAddressChange={handleSelectedAddressChange}
          onAddressesLoaded={handleAddressesLoaded}
          disabled={checkoutBusy}
        />
        <CheckoutShippingSummary
          selectedQuote={shipping.selectedQuote}
          availableQuotes={shipping.availableQuotes}
          onSelectQuote={shipping.selectQuote}
          loading={shipping.loading}
          error={shipping.error}
          onRetry={shipping.refreshQuotes}
          disabled={checkoutBusy}
        />
        <MercadoPagoCardForm
          cartItems={cartItems}
          cartTotal={cartItems.reduce((total, item) => total + item.price * item.quantity, 0)}
          shippingQuoteToken={shipping.selectedQuote?.quoteToken ?? null}
          paymentTotal={shipping.selectedQuote?.paymentTotal ?? null}
          deliveryAddressId={deliveryAddressId}
          onPaymentBusyChange={setCheckoutBusy}
        />
      </div>
    </main>
  );
}
