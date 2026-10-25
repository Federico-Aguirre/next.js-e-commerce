'use client';

import { ArrowLeft, CreditCard, Wallet } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TaxInclusivePrice } from '@/components/TaxInclusivePrice';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/providers/CurrencyProvider';
import { useCartStore } from '@/store/useCartStore';

type Props = {
  language: 'es' | 'en';
};

type PaymentMethods = {
  mercadoPago: boolean;
  paypal: boolean;
  stripe: boolean;
};

const copy = {
  es: {
    title: 'Compra directa',
    subtitle: 'Revisá el producto y elegí cómo pagar. Tu carrito habitual se conservará.',
    order: 'Tu compra',
    quantity: 'Cantidad',
    total: 'Total estimado',
    checking: 'Verificando medios de pago…',
    loadError:
      'No se pudieron verificar los medios de pago. Actualizá la página para volver a intentar.',
    mercadoPago: 'Pagar con Mercado Pago',
    paypal: 'Pagar con PayPal',
    stripe: 'Pagar con tarjeta (Stripe)',
    notConnected: 'No conectado',
    unavailable: 'No hay medios de pago disponibles en este momento.',
    back: 'Volver al carrito',
    signInTitle: 'Iniciá sesión para comprar',
    signInText: 'Necesitás iniciar sesión antes de continuar con el pago.',
    signIn: 'Iniciar sesión',
    preparing: 'Preparando tu compra…',
  },
  en: {
    title: 'Buy now',
    subtitle: 'Review the item and choose how to pay. Your regular cart will be preserved.',
    order: 'Your purchase',
    quantity: 'Quantity',
    total: 'Estimated total',
    checking: 'Checking payment methods…',
    loadError: 'Payment methods could not be verified. Refresh the page to try again.',
    mercadoPago: 'Pay with Mercado Pago',
    paypal: 'Pay with PayPal',
    stripe: 'Pay by card (Stripe)',
    notConnected: 'Not connected',
    unavailable: 'No payment methods are currently available.',
    back: 'Return to cart',
    signInTitle: 'Sign in to buy',
    signInText: 'You must sign in before continuing to payment.',
    signIn: 'Sign in',
    preparing: 'Preparing your purchase…',
  },
} as const;

export default function BuyNowPaymentSelector({ language }: Props) {
  const router = useRouter();
  const text = copy[language];
  const { data: session, status } = useSession();
  const cartItems = useCartStore((state) => state.cart);
  const isBuyNow = useCartStore((state) => state.isBuyNow);
  const { currency } = useCurrency();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/payment-methods/status', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Payment method status unavailable');
        return (await response.json()) as Partial<PaymentMethods>;
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
        if (!active) return;
        setLoadFailed(true);
        setPaymentMethods({ mercadoPago: false, paypal: false, stripe: false });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status !== 'loading' && (!isBuyNow || cartItems.length === 0)) {
      router.replace('/cart');
    }
  }, [cartItems.length, isBuyNow, router, status]);

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const locale = language === 'es' ? 'es-AR' : 'en-US';
  const hasProvider = paymentMethods !== null && Object.values(paymentMethods).some(Boolean);

  if (status === 'loading' || !isBuyNow || cartItems.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {text.preparing}
        </p>
      </main>
    );
  }

  if (!session?.user) {
    const signInPath = language === 'es' ? '/es/sign-in' : '/sign-in';
    const callbackUrl = `/checkout/select?lang=${language}`;
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">{text.signInTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{text.signInText}</p>
          <Link
            href={`${signInPath}?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {text.signIn}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-background px-4 py-10 text-foreground"
    >
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/cart"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {text.back}
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{text.subtitle}</p>

          <section className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
            <h2 className="mb-4 text-sm font-semibold">{text.order}</h2>
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div
                  key={`${item.articleId}-${item.size}`}
                  className="flex items-start justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.colorName} · {item.size} · {text.quantity}: {item.quantity}
                    </p>
                  </div>
                  <TaxInclusivePrice
                    amount={item.price * item.quantity}
                    locale={locale}
                    className="shrink-0 font-semibold"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm font-semibold">{text.total}</span>
              <TaxInclusivePrice
                amount={cartTotal}
                locale={currency === 'ARS' ? 'es-AR' : locale}
                className="text-lg font-bold"
              />
            </div>
          </section>

          <section className="mt-6 space-y-3" aria-label={text.title}>
            {paymentMethods === null && !loadFailed && (
              <p role="status" className="text-sm text-muted-foreground">
                {text.checking}
              </p>
            )}
            {loadFailed && (
              <p role="alert" className="text-sm text-destructive">
                {text.loadError}
              </p>
            )}

            <Button
              type="button"
              variant="mercadopago"
              size="lg"
              disabled={paymentMethods?.mercadoPago !== true}
              onClick={() => router.push('/checkout')}
              className="min-h-12 w-full"
            >
              <Wallet className="size-4" aria-hidden="true" />
              {paymentMethods?.mercadoPago === false
                ? `${text.mercadoPago} · ${text.notConnected}`
                : text.mercadoPago}
            </Button>
            <Button
              type="button"
              variant="paypal"
              size="lg"
              disabled={paymentMethods?.paypal !== true}
              onClick={() => router.push('/checkout/paypal')}
              className="min-h-12 w-full"
            >
              <Wallet className="size-4" aria-hidden="true" />
              {paymentMethods?.paypal === false
                ? `${text.paypal} · ${text.notConnected}`
                : text.paypal}
            </Button>
            <Button
              type="button"
              variant="stripe"
              size="lg"
              disabled={paymentMethods?.stripe !== true}
              onClick={() => router.push('/checkout/stripe')}
              className="min-h-12 w-full"
            >
              <CreditCard className="size-4" aria-hidden="true" />
              {paymentMethods?.stripe === false
                ? `${text.stripe} · ${text.notConnected}`
                : text.stripe}
            </Button>
            {paymentMethods !== null && !hasProvider && !loadFailed && (
              <p className="text-sm text-muted-foreground">{text.unavailable}</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
