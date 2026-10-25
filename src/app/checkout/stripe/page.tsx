'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthRequiredNotice } from '@/components/checkout/AuthRequiredNotice';
import CheckoutShippingSummary from '@/components/checkout/CheckoutShippingSummary';
import DeliveryAddressSummary from '@/components/checkout/DeliveryAddressSummary';
import StripePaymentForm from '@/components/checkout/stripe/StripePaymentForm';
import { useCheckoutShipping } from '@/components/checkout/useCheckoutShipping';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/useCartStore';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_DEVELOPER_STRIPE_PUBLISHABLE_KEY || '');

type StripeCheckoutData = {
  clientSecret: string;
  paymentIntentId: string;
  orderId: string;
  paymentTotal: number;
  paymentCurrency: string;
  totalInStoreCurrency: number;
  subtotal: number;
  taxAmount: number;
  taxRate: number | null;
  taxCalculationMethod: string | null;
  taxName: string | null;
  taxCountry: string | null;
  currency: string;
};

export default function StripeCheckoutPage() {
  const { data: session, status: sessionStatus } = useSession();
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
    'ARS',
    sessionStatus === 'authenticated' && deliveryAddressesLoaded && Boolean(deliveryAddressId),
    deliveryAddressId,
  );

  const finishCheckout = useCartStore((state) => state.finishCheckout);
  const isBuyNow = useCartStore((state) => state.isBuyNow);

  const [stripeData, setStripeData] = useState<StripeCheckoutData | null>(null);

  const [loading, setLoading] = useState(false);
  const [checkoutRequested, setCheckoutRequested] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [completed, setCompleted] = useState(false);

  const checkoutPromiseRef = useRef<Promise<StripeCheckoutData> | null>(null);
  const checkoutKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      sessionStatus !== 'authenticated' ||
      cartItems.length === 0 ||
      completed ||
      !checkoutRequested ||
      !shipping.selectedQuote
    ) {
      return;
    }

    const selectedShippingQuote = shipping.selectedQuote;
    if (!selectedShippingQuote) return;

    let active = true;

    if (!checkoutKeyRef.current) {
      const storedKey = sessionStorage.getItem('stripe_checkout_key');
      checkoutKeyRef.current = storedKey || crypto.randomUUID();
      sessionStorage.setItem('stripe_checkout_key', checkoutKeyRef.current);
    }

    if (!checkoutPromiseRef.current) {
      const checkoutKey = checkoutKeyRef.current;
      checkoutPromiseRef.current = (async () => {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cartItems,
            paymentMethod: 'stripe',
            checkoutKey,
            shippingQuoteToken: selectedShippingQuote.quoteToken,
            ...(deliveryAddressId ? { deliveryAddressId } : {}),
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'No se pudo iniciar el pago con Stripe.');
        }
        if (
          !data.clientSecret ||
          !data.paymentIntentId ||
          !data.orderId ||
          !Number.isFinite(Number(data.paymentTotal)) ||
          !data.paymentCurrency ||
          !Number.isFinite(Number(data.totalInStoreCurrency))
        ) {
          throw new Error('La respuesta de Stripe no contiene un importe y una moneda válidos.');
        }

        return {
          clientSecret: data.clientSecret as string,
          paymentIntentId: data.paymentIntentId as string,
          orderId: data.orderId as string,
          paymentTotal: Number(data.paymentTotal),
          paymentCurrency: String(data.paymentCurrency),
          totalInStoreCurrency: Number(data.totalInStoreCurrency),
          subtotal: Number(data.subtotal),
          taxAmount: Number(data.taxAmount),
          taxRate: data.taxRate == null ? null : Number(data.taxRate),
          taxCalculationMethod: data.taxCalculationMethod
            ? String(data.taxCalculationMethod)
            : null,
          taxName: data.taxName ? String(data.taxName) : null,
          taxCountry: data.taxCountry ? String(data.taxCountry) : null,
          currency: String(data.currency || 'ARS'),
        };
      })();
    }

    checkoutPromiseRef.current
      .then((data) => {
        if (active) setStripeData(data);
      })
      .catch((error: unknown) => {
        checkoutPromiseRef.current = null;
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : 'No se pudo iniciar el pago.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    cartItems,
    completed,
    sessionStatus,
    checkoutRequested,
    shipping.selectedQuote,
    deliveryAddressId,
  ]);

  const handleSuccess = () => {
    setCompleted(true);

    if (isBuyNow) {
      sessionStorage.removeItem('stripe_payment_success');
    } else {
      sessionStorage.setItem('stripe_payment_success', 'true');
    }
    sessionStorage.removeItem('stripe_checkout_key');
    sessionStorage.removeItem('stripe_checkout_quote_token');

    alert('¡Compra realizada con éxito!');

    finishCheckout();

    window.location.replace('/historial');
  };

  if (sessionStatus === 'loading') {
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
            className="inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
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
            <h1 className="text-xl font-bold text-foreground">Pago con Stripe</h1>

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
            disabled={checkoutRequested || Boolean(stripeData)}
          />
          <CheckoutShippingSummary
            selectedQuote={shipping.selectedQuote}
            availableQuotes={shipping.availableQuotes}
            onSelectQuote={shipping.selectQuote}
            loading={shipping.loading}
            error={shipping.error}
            onRetry={shipping.refreshQuotes}
            disabled={checkoutRequested || Boolean(stripeData)}
          />

          {!checkoutRequested && !stripeData && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={shipping.loading || !shipping.selectedQuote || Boolean(shipping.error)}
              onClick={() => {
                const quoteToken = shipping.selectedQuote?.quoteToken;
                if (!quoteToken) return;
                const previousQuoteToken = sessionStorage.getItem('stripe_checkout_quote_token');
                if (previousQuoteToken !== quoteToken) {
                  sessionStorage.removeItem('stripe_checkout_key');
                  checkoutKeyRef.current = null;
                  checkoutPromiseRef.current = null;
                  sessionStorage.setItem('stripe_checkout_quote_token', quoteToken);
                }
                setErrorMessage(null);
                setLoading(true);
                setCheckoutRequested(true);
              }}
              className="mb-6 w-full rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar al pago de{' '}
              {new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS',
                currencyDisplay: 'code',
              }).format(shipping.selectedQuote?.totalInStoreCurrency ?? 0)}
            </Button>
          )}

          {loading && (
            <div className="flex min-h-40 items-center justify-center">
              <p className="text-sm font-medium text-muted-foreground">
                Preparando el formulario de pago...
              </p>
            </div>
          )}

          {errorMessage && !loading && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-sm font-medium text-destructive">{errorMessage}</p>

              <div className="mt-4 flex flex-wrap gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    checkoutPromiseRef.current = null;
                    setCheckoutRequested(false);
                    setErrorMessage(null);
                    setLoading(false);
                  }}
                  className="text-sm font-bold text-destructive underline"
                >
                  Reintentar el pago
                </Button>
                <Link href="/cart" className="text-sm font-bold text-destructive underline">
                  Volver al carrito
                </Link>
              </div>
            </div>
          )}

          {stripeData && !loading && !errorMessage && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: stripeData.clientSecret,
              }}
            >
              <StripePaymentForm
                clientSecret={stripeData.clientSecret}
                orderId={stripeData.orderId}
                paymentIntentId={stripeData.paymentIntentId}
                amount={stripeData.paymentTotal}
                onSuccess={handleSuccess}
              />
            </Elements>
          )}
        </div>
      </div>
    </main>
  );
}
