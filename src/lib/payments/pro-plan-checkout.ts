import 'server-only';
import { createHash } from 'node:crypto';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { DEFAULT_PRO_MONTHLY_PRICE_ARS, PRO_COMMISSION_PERCENT, PRO_PLAN } from './plan-pricing';

export const PRO_CHECKOUT_AMOUNT_ARS = DEFAULT_PRO_MONTHLY_PRICE_ARS;
const PRO_CHECKOUT_AMOUNT_MINOR = PRO_CHECKOUT_AMOUNT_ARS * 100;

function stripeForProBilling() {
  const key = process.env.DEVELOPER_STRIPE_SECRET_KEY?.trim();
  const configuredEnvironment =
    process.env.STRIPE_ENVIRONMENT?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'invalid' : 'sandbox');
  if (configuredEnvironment !== 'sandbox' || !key?.startsWith('sk_test_')) {
    throw new Error('PRO_BILLING_SANDBOX_UNAVAILABLE');
  }
  return new Stripe(key);
}

function appOrigin() {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!raw) throw new Error('PRO_BILLING_APP_URL_MISSING');
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('PRO_BILLING_APP_URL_INVALID');
  }
  return url.origin;
}

export function nextBuenosAiresMonthStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return new Date(Date.UTC(year, month, 1, 3, 0, 0, 0));
}

function initialProPaidThrough(now: Date) {
  // The first fee is charged immediately when Pro is selected. Its calendar-month
  // renewal is then due on the first day of the following month in Argentina time.
  return nextBuenosAiresMonthStart(now);
}

export type ProCheckoutStartResult =
  | { ok: true; url: string; reused: boolean }
  | {
      ok: false;
      code:
        | 'PRO_ALREADY_ACTIVE'
        | 'STRIPE_UNAVAILABLE'
        | 'CHECKOUT_FAILED'
        | 'STOREFRONT_CLOSED'
        | 'PRO_PAYMENT_PENDING';
    };

export async function createProPlanCheckoutSession({
  adminUserId,
  email,
  locale,
}: {
  adminUserId: string;
  email?: string | null;
  locale: string;
}): Promise<ProCheckoutStartResult> {
  const safeLocale = locale === 'es' ? 'es' : 'en';
  const localePrefix = safeLocale === 'es' ? '/es' : '';
  const now = new Date();
  const subscription = await prisma.storeSubscription.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      status: 'ACTIVE',
      planType: 'STANDARD',
      commissionPercent: 8,
      monthlyPriceARS: PRO_CHECKOUT_AMOUNT_ARS,
      customizationRecoveryActive: false,
      setupRecoveryTarget: 200_000,
    },
    update: {},
  });

  if (subscription.storefrontStatus !== 'OPEN') {
    return { ok: false, code: 'STOREFRONT_CLOSED' };
  }
  if (subscription.pendingProPaymentId) {
    return { ok: false, code: 'PRO_PAYMENT_PENDING' };
  }

  if (
    subscription.planType === PRO_PLAN &&
    subscription.nextPaymentAt &&
    subscription.nextPaymentAt.getTime() > now.getTime()
  ) {
    return { ok: false, code: 'PRO_ALREADY_ACTIVE' };
  }

  let stripe: Stripe;
  try {
    stripe = stripeForProBilling();
  } catch {
    return { ok: false, code: 'STRIPE_UNAVAILABLE' };
  }

  if (subscription.pendingProCheckoutSessionId) {
    try {
      const pending = await stripe.checkout.sessions.retrieve(
        subscription.pendingProCheckoutSessionId,
      );
      if (
        pending.status === 'open' &&
        pending.url &&
        !pending.livemode &&
        pending.expires_at > Math.floor(now.getTime() / 1000)
      ) {
        return { ok: true, url: pending.url, reused: true };
      }
      if (pending.status === 'complete' && pending.payment_status === 'paid' && !pending.livemode) {
        const origin = appOrigin();
        const localePrefix = safeLocale === 'es' ? '/es' : '';
        return {
          ok: true,
          url: `${origin}${localePrefix}/dashboard/plan/success?session_id=${encodeURIComponent(pending.id)}`,
          reused: true,
        };
      }
      if (pending.status === 'open') {
        try {
          await stripe.checkout.sessions.expire(pending.id);
        } catch {
          // Provider reports may race with the local expiry timestamp; a new session is still safe.
        }
      }
    } catch {
      // A missing/expired provider session is replaced below; no plan is activated here.
    }
  }

  try {
    const origin = appOrigin();
    const metadata = {
      adminUserId,
      subscriptionId: 'default',
      planType: PRO_PLAN,
      billingAmountARS: String(PRO_CHECKOUT_AMOUNT_ARS),
    };
    const idempotencySuffix = createHash('sha256')
      .update(`${adminUserId}:${subscription.updatedAt.toISOString()}`)
      .digest('hex')
      .slice(0, 28);
    const expiresAt = Math.floor(now.getTime() / 1000) + 35 * 60;
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'ars',
              unit_amount: PRO_CHECKOUT_AMOUNT_MINOR,
              product_data: {
                name: 'Plan Pro mensual',
                description: 'Abono mensual del comercio; 2% de comisión por transacción.',
              },
            },
            quantity: 1,
          },
        ],
        client_reference_id: adminUserId,
        ...(email ? { customer_email: email } : {}),
        locale: 'auto',
        expires_at: expiresAt,
        metadata,
        payment_intent_data: { metadata },
        success_url: `${origin}${localePrefix}/dashboard/plan/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${localePrefix}/dashboard?planPayment=cancelled`,
      },
      { idempotencyKey: `store-pro-checkout-${idempotencySuffix}` },
    );

    if (!session.url || !session.expires_at || session.livemode) {
      throw new Error('PRO_CHECKOUT_SESSION_INVALID');
    }

    const savedPendingCheckout = await prisma.storeSubscription.updateMany({
      where: { id: 'default', storefrontStatus: 'OPEN' },
      data: {
        pendingProCheckoutSessionId: session.id,
        pendingProCheckoutExpiresAt: new Date(session.expires_at * 1000),
      },
    });

    if (savedPendingCheckout.count !== 1) {
      // A closure can win while Stripe is creating this session. Do not return
      // an actionable checkout URL after that cutoff.
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch {
        // The finalizer also refuses to activate Pro while the storefront is closed.
      }
      return { ok: false, code: 'STOREFRONT_CLOSED' };
    }

    return { ok: true, url: session.url, reused: false };
  } catch (error) {
    console.error('No se pudo crear el checkout sandbox del plan Pro.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return { ok: false, code: 'CHECKOUT_FAILED' };
  }
}

export async function expirePendingProCheckout(sessionId: string | null | undefined) {
  if (!sessionId) return;
  const stripe = stripeForProBilling();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    // A stale session pointer should not permanently prevent choosing Standard.
    if ((error as { code?: string })?.code === 'resource_missing') return;
    throw error;
  }
  if (session.status === 'complete' && session.payment_status === 'paid') {
    throw new Error('PRO_CHECKOUT_ALREADY_PAID');
  }
  if (session.status === 'open') await stripe.checkout.sessions.expire(sessionId);
}

export async function completeProPlanCheckout(sessionId: string, adminUserId: string) {
  const stripe = stripeForProBilling();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (
    session.mode !== 'payment' ||
    session.status !== 'complete' ||
    session.payment_status !== 'paid' ||
    session.livemode ||
    session.amount_total !== PRO_CHECKOUT_AMOUNT_MINOR ||
    session.currency?.toLowerCase() !== 'ars' ||
    session.client_reference_id !== adminUserId ||
    session.metadata?.adminUserId !== adminUserId ||
    session.metadata?.subscriptionId !== 'default' ||
    session.metadata?.planType !== PRO_PLAN ||
    session.metadata?.billingAmountARS !== String(PRO_CHECKOUT_AMOUNT_ARS)
  ) {
    throw new Error('PRO_CHECKOUT_NOT_PAID_OR_INVALID');
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) throw new Error('PRO_CHECKOUT_PAYMENT_INTENT_MISSING');

  const existingPayment = await prisma.storeSubscriptionPayment.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });
  if (existingPayment) {
    if (existingPayment.adminUserId !== adminUserId) throw new Error('PRO_CHECKOUT_OWNER_MISMATCH');
    const current = await prisma.storeSubscription.findUnique({
      where: { id: 'default' },
      select: { storefrontStatus: true },
    });
    return {
      alreadyProcessed: true,
      paidThrough: existingPayment.paidThrough,
      storefrontClosed: current?.storefrontStatus !== 'OPEN',
    };
  }

  const paidAt = new Date();
  const now = paidAt;
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.storeSubscription.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        status: 'ACTIVE',
        planType: 'STANDARD',
        commissionPercent: 8,
        monthlyPriceARS: PRO_CHECKOUT_AMOUNT_ARS,
        customizationRecoveryActive: false,
        setupRecoveryTarget: 200_000,
      },
      update: { updatedAt: new Date() },
    });
    // Serialize finalizers on the single subscription row, then double-check idempotency.
    const previous = await tx.storeSubscriptionPayment.findUnique({
      where: { stripeCheckoutSessionId: session.id },
    });
    if (previous) {
      if (previous.adminUserId !== adminUserId) throw new Error('PRO_CHECKOUT_OWNER_MISMATCH');
      return { alreadyProcessed: true, paidThrough: previous.paidThrough };
    }

    const isRenewalOrPreviouslySelectedPro = current.planType === PRO_PLAN;
    const dueAnchor =
      current.planType === PRO_PLAN &&
      current.nextPaymentAt &&
      current.nextPaymentAt.getTime() > paidAt.getTime()
        ? current.nextPaymentAt
        : now;
    const paidThrough = isRenewalOrPreviouslySelectedPro
      ? nextBuenosAiresMonthStart(dueAnchor)
      : initialProPaidThrough(now);
    await tx.storeSubscriptionPayment.create({
      data: {
        subscriptionId: 'default',
        adminUserId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        amountARS: PRO_CHECKOUT_AMOUNT_ARS,
        currency: 'ARS',
        status: 'PAID',
        paidAt,
        paidThrough,
      },
    });
    const storefrontClosed = current.storefrontStatus !== 'OPEN';
    if (!storefrontClosed) {
      await tx.storeSubscription.update({
        where: { id: 'default' },
        data: {
          status: 'ACTIVE',
          planType: PRO_PLAN,
          commissionPercent: PRO_COMMISSION_PERCENT,
          nextPaymentAt: paidThrough,
          pendingProCheckoutSessionId: null,
          pendingProCheckoutExpiresAt: null,
        },
      });
    }
    return { alreadyProcessed: false, paidThrough, storefrontClosed };
  });
  return result;
}
