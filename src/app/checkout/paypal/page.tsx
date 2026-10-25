'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { AuthRequiredNotice } from '@/components/checkout/AuthRequiredNotice';
import CheckoutShippingSummary from '@/components/checkout/CheckoutShippingSummary';
import DeliveryAddressSummary from '@/components/checkout/DeliveryAddressSummary';
import PayPalCardForm from '@/components/checkout/paypal/PayPalCardForm';
import { useCheckoutShipping } from '@/components/checkout/useCheckoutShipping';
import { useCartStore } from '@/store/useCartStore';

export default function PayPalCheckoutPage() {
  const { data: session, status } = useSession();
  const cartItems = useCartStore((state) => state.cart);
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
    'USD',
    status === 'authenticated' && deliveryAddressesLoaded && Boolean(deliveryAddressId),
    deliveryAddressId,
  );

  const finishCheckout = useCartStore((state) => state.finishCheckout);

  const [completed, setCompleted] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const handleSuccess = useCallback(() => {
    setCompleted(true);

    finishCheckout();

    window.location.replace('/historial');
  }, [finishCheckout]);

  if (status === 'loading') {
    return <div className="p-8 text-center">Cargando...</div>;
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

  if (cartItems.length === 0 && !completed) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen items-center justify-center bg-muted/40 px-4"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="mb-4 text-lg font-bold text-foreground">Tu carrito está vacío</p>

          <Link
            href="/cart"
            className="inline-flex rounded-lg bg-paypal px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-paypal/90"
          >
            Volver al carrito
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h1 className="text-xl font-bold text-foreground">Pago con PayPal</h1>

            <Link
              href="/cart"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              ← Volver
            </Link>
          </div>

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

          <PayPalCardForm
            cartItems={cartItems}
            onSuccess={handleSuccess}
            shippingQuoteToken={shipping.selectedQuote?.quoteToken ?? null}
            paymentTotal={shipping.selectedQuote?.paymentTotal ?? null}
            deliveryAddressId={deliveryAddressId}
            onPaymentBusyChange={setCheckoutBusy}
          />
        </div>
      </div>
    </main>
  );
}
