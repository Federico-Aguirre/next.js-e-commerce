import { connection, NextResponse } from 'next/server';
import { requireDashboardAdmin } from '@/app/[locale]/dashboard/data';
import { getLatestUsdExchangeRates, getConversionRate } from '@/lib/currency/exchange-rates';
import { getDeveloperMercadoPagoSandboxContext } from '@/lib/payments/developer-mercadopago-sandbox';
import { PRO_PLAN_AMOUNT_ARS } from '@/lib/payments/pro-plan-billing';
import { prisma } from '@/lib/prisma';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET() {
  await connection();
  try {
    await requireDashboardAdmin();
    const subscription = await prisma.storeSubscription.findUnique({
      where: { id: 'default' },
      select: {
        storefrontStatus: true,
        planType: true,
        nextPaymentAt: true,
        pendingProPaymentId: true,
        pendingProPaymentProvider: true,
        pendingProPaymentExpiresAt: true,
        pendingProCheckoutSessionId: true,
      },
    });

    const stripeEnvironment =
      process.env.STRIPE_ENVIRONMENT?.trim() ||
      (process.env.NODE_ENV === 'production' ? 'invalid' : 'sandbox');
    const stripeEnabled =
      stripeEnvironment === 'sandbox' &&
      Boolean(process.env.DEVELOPER_STRIPE_SECRET_KEY?.trim()?.startsWith('sk_test_')) &&
      Boolean(
        process.env.NEXT_PUBLIC_DEVELOPER_STRIPE_PUBLISHABLE_KEY?.trim()?.startsWith('pk_test_'),
      );

    const paypalEnvironment =
      process.env.PAYPAL_ENVIRONMENT?.trim() ||
      (process.env.NODE_ENV === 'production' ? 'invalid' : 'sandbox');
    const paypalEnabled =
      paypalEnvironment === 'sandbox' &&
      process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT !== 'production' &&
      Boolean(process.env.DEVELOPER_PAYPAL_CLIENT_ID?.trim()) &&
      Boolean(process.env.DEVELOPER_PAYPAL_CLIENT_SECRET?.trim()) &&
      Boolean(process.env.DEVELOPER_PAYPAL_MERCHANT_ID?.trim()) &&
      Boolean(process.env.DEVELOPER_PAYPAL_PARTNER_ATTRIBUTION_ID?.trim());

    const mercadoPagoContext = await getDeveloperMercadoPagoSandboxContext();
    const mercadoPagoEnabled = Boolean(mercadoPagoContext);

    let paypalQuote: { amount: number; exchangeRate: number; rateUpdatedAt: string } | null = null;
    if (paypalEnabled) {
      try {
        const quote = await getLatestUsdExchangeRates();
        const exchangeRate = getConversionRate('ARS', 'USD', quote.rates);
        paypalQuote = {
          amount: Math.round(PRO_PLAN_AMOUNT_ARS * exchangeRate * 100) / 100,
          exchangeRate,
          rateUpdatedAt: quote.updatedAt,
        };
      } catch {
        // PayPal is shown unavailable for this attempt if the required currency quote is unavailable.
      }
    }

    const proActive =
      subscription?.planType === 'PRO' &&
      Boolean(subscription.nextPaymentAt && subscription.nextPaymentAt.getTime() > Date.now());
    const pendingPayment =
      subscription?.pendingProPaymentId && subscription.pendingProPaymentProvider
        ? await prisma.storeSubscriptionPayment.findFirst({
            where: {
              paymentProvider: subscription.pendingProPaymentProvider,
              externalPaymentId: subscription.pendingProPaymentId,
              status: 'PENDING',
            },
            select: { paymentAttemptId: true, paymentMethodRef: true },
          })
        : null;
    const paymentPending =
      Boolean(subscription?.pendingProCheckoutSessionId) ||
      Boolean(subscription?.pendingProPaymentId);

    return NextResponse.json(
      {
        amountARS: PRO_PLAN_AMOUNT_ARS,
        storefrontOpen: (subscription?.storefrontStatus ?? 'OPEN') === 'OPEN',
        proActive,
        paymentPending,
        pendingPaymentProvider:
          subscription?.pendingProPaymentProvider ??
          (subscription?.pendingProCheckoutSessionId ? 'STRIPE' : null),
        pendingPaymentAttemptId: pendingPayment?.paymentAttemptId ?? null,
        pendingSavedPaymentMethodId: pendingPayment?.paymentMethodRef ?? null,
        providers: {
          STRIPE: {
            enabled: stripeEnabled,
            currency: 'ARS',
            reason: stripeEnabled ? null : 'STRIPE_NOT_CONFIGURED',
          },
          PAYPAL: {
            enabled: paypalEnabled && Boolean(paypalQuote),
            currency: 'USD',
            amount: paypalQuote?.amount ?? null,
            exchangeRate: paypalQuote?.exchangeRate ?? null,
            rateUpdatedAt: paypalQuote?.rateUpdatedAt ?? null,
            reason: !paypalEnabled
              ? 'PAYPAL_NOT_CONFIGURED'
              : !paypalQuote
                ? 'EXCHANGE_RATE_UNAVAILABLE'
                : null,
          },
          MERCADOPAGO: {
            enabled: mercadoPagoEnabled,
            currency: 'ARS',
            publicKey: mercadoPagoContext?.publicKey ?? null,
            reason: mercadoPagoEnabled ? null : 'MERCADOPAGO_SANDBOX_CREDENTIALS_UNAVAILABLE',
          },
        },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error(
      '[pro-payment-options] failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return NextResponse.json(
      { error: 'No se pudo consultar la disponibilidad de los métodos de pago.' },
      { status: 500, headers: NO_STORE },
    );
  }
}
