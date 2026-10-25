'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthRequiredNotice } from '@/components/checkout/AuthRequiredNotice';
import { TaxInclusivePrice } from '@/components/TaxInclusivePrice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeading } from '@/components/ui/section-heading';
import { calculateBasketTax } from '@/lib/tax/tax-calculation';
import { useCurrency } from '@/providers/CurrencyProvider';
import { useCartStore } from '@/store/useCartStore';
import { StoreConfig } from '@/utils/StoreConfig';

export default function CartPage() {
  // Carrito REAL de Zustand
  const cartItems = useCartStore((state) => state.cart);
  const clearCart = useCartStore((state) => state.clearCart);
  const isBuyNow = useCartStore((state) => state.isBuyNow);
  const cancelBuyNow = useCartStore((state) => state.cancelBuyNow);

  const { data: session } = useSession();
  const [showAuthNotice, setShowAuthNotice] = useState(false);

  useEffect(() => {
    if (isBuyNow) cancelBuyNow();
  }, [isBuyNow, cancelBuyNow]);
  const [paymentMethods, setPaymentMethods] = useState<{
    mercadoPago: boolean;
    paypal: boolean;
    stripe: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/payment-methods/status')
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo verificar los medios de pago.');
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setPaymentMethods({
          mercadoPago: data.mercadoPago === true,
          paypal: data.paypal === true,
          stripe: data.stripe === true,
        });
      })
      .catch(() => {
        if (active) setPaymentMethods({ mercadoPago: false, paypal: false, stripe: false });
      });
    return () => {
      active = false;
    };
  }, []);
  const cartTotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const { currency, taxProfile } = useCurrency();
  const basketTax = calculateBasketTax(
    cartItems.map((item) => ({ price: item.price, quantity: item.quantity })),
    taxProfile?.rate,
    StoreConfig.currency,
    taxProfile?.calculationMethod,
  );
  const canPayWithPayPal =
    Boolean(session?.user) && paymentMethods?.paypal === true && cartItems.length > 0;
  const canPayWithStripe =
    Boolean(session?.user) && paymentMethods?.stripe === true && cartItems.length > 0;
  const canPayWithMercadoPago =
    Boolean(session?.user) && paymentMethods?.mercadoPago === true && cartItems.length > 0;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-4xl">
        <SectionHeading level="h1" title="Your Shopping Cart" className="mb-8" />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* LEFT SIDE: ITEMS */}
          <div className="space-y-4 md:col-span-2">
            {cartItems.length === 0 ? (
              <EmptyState
                className="border-solid py-8 shadow-sm"
                title="Your cart is currently empty."
              />
            ) : (
              cartItems.map((item) => (
                <Card
                  as="article"
                  key={`${item.articleId}-${item.size}`}
                  variant="default"
                  padding="default"
                  className="flex-row items-center justify-between gap-4"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="relative h-20 w-20 flex-shrink-0 rounded-xl border border-border bg-muted/40 p-2">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="h-full w-full object-contain mix-blend-multiply"
                        />
                      ) : (
                        <div className="h-full w-full rounded-lg bg-muted" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="line-clamp-1 text-sm font-bold text-foreground">
                        {item.title}
                      </h2>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Quantity: {item.quantity}
                      </p>

                      <p className="text-xs text-muted-foreground">Size: {item.size}</p>

                      <p className="text-xs text-muted-foreground">Color: {item.colorName}</p>

                      <TaxInclusivePrice
                        amount={item.price}
                        locale={currency === 'ARS' ? 'es-AR' : 'en-US'}
                        compact
                      />
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    <TaxInclusivePrice
                      amount={item.price * item.quantity}
                      grossAmountOverride={
                        calculateBasketTax(
                          [{ price: item.price, quantity: item.quantity }],
                          taxProfile?.rate,
                          StoreConfig.currency,
                          taxProfile?.calculationMethod,
                        ).total
                      }
                      locale={currency === 'ARS' ? 'es-AR' : 'en-US'}
                      className="text-sm font-black text-foreground"
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() =>
                        useCartStore.getState().removeFromCart(item.articleId, item.size)
                      }
                      className="text-xs font-semibold text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              ))
            )}

            {cartItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={clearCart}
                className="text-sm font-semibold text-destructive hover:text-destructive"
              >
                Clear cart
              </Button>
            )}
          </div>

          {/* RIGHT SIDE: ORDER SUMMARY */}
          <Card variant="default" padding="lg" className="h-fit gap-0">
            <h2 className="mb-4 text-lg font-black text-foreground">Order Summary</h2>

            <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
              <span className="text-sm font-medium text-muted-foreground">
                {currency === 'ARS' ? 'Total:' : 'Base price:'}
              </span>

              <TaxInclusivePrice
                amount={cartTotal}
                grossAmountOverride={basketTax.total}
                locale={currency === 'ARS' ? 'es-AR' : 'en-US'}
                className="text-xl font-black text-foreground"
              />
            </div>

            <div className="space-y-3">
              {showAuthNotice && <AuthRequiredNotice />}
              {paymentMethods === null && (
                <p className="text-xs font-medium text-muted-foreground">
                  Verificando medios de pago...
                </p>
              )}
              <Button
                asChild
                variant="paypal"
                size="lg"
                className={`h-12 w-full ${canPayWithPayPal ? '' : 'cursor-not-allowed opacity-50'}`}
              >
                <Link
                  href="/checkout/paypal"
                  onClick={(event) => {
                    if (!canPayWithPayPal) {
                      event.preventDefault();
                      if (!session?.user) setShowAuthNotice(true);
                    }
                  }}
                  aria-disabled={!canPayWithPayPal}
                >
                  {paymentMethods?.paypal === false ? 'PayPal no conectado' : 'Pay with PayPal'}
                </Link>
              </Button>

              {/* STRIPE */}
              <Button
                asChild
                variant="stripe"
                size="lg"
                className={`h-12 w-full ${canPayWithStripe ? '' : 'cursor-not-allowed opacity-50'}`}
              >
                <Link
                  href="/checkout/stripe"
                  onClick={(event) => {
                    if (!canPayWithStripe) {
                      event.preventDefault();
                      if (!session?.user) setShowAuthNotice(true);
                    }
                  }}
                  aria-disabled={!canPayWithStripe}
                >
                  {paymentMethods?.stripe === false ? 'Stripe no conectado' : 'Pay with Stripe'}
                </Link>
              </Button>

              {/* MERCADO PAGO */}
              <Button
                asChild
                variant="mercadopago"
                size="lg"
                className={`h-12 w-full ${canPayWithMercadoPago ? '' : 'cursor-not-allowed opacity-50'}`}
              >
                <Link
                  href="/checkout"
                  onClick={(event) => {
                    if (!canPayWithMercadoPago) {
                      event.preventDefault();
                      if (!session?.user) setShowAuthNotice(true);
                    }
                  }}
                  aria-disabled={!canPayWithMercadoPago}
                >
                  {paymentMethods?.mercadoPago === false
                    ? 'Mercado Pago no conectado'
                    : 'Pagar con Mercado Pago'}
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
