import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { requireDashboardAdmin } from '@/app/[locale]/dashboard/data';
import {
  assertProPlanCanBePurchased,
  completeRegisteredProPayment,
  failRegisteredProPayment,
  findProPaymentAttempt,
  ProPlanBillingError,
  registerPendingProPayment,
} from '@/lib/payments/pro-plan-billing';
import {
  getOrCreateStripePaymentCustomer,
  getStripeSavedCardScope,
} from '@/lib/payments/stripe-saved-cards';
import { prisma } from '@/lib/prisma';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const PRICE_ARS = 75_000;
const PRICE_MINOR = PRICE_ARS * 100;
const StripeProRequestSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('prepare'),
      paymentAttemptId: z.string().uuid(),
      savedPaymentMethodId: z.string().trim().min(1).max(191).optional(),
      savePaymentMethod: z.boolean().optional().default(true),
    })
    .strict()
    .refine((value) => !(value.savedPaymentMethodId && value.savePaymentMethod), {
      message: 'Elegí una tarjeta guardada o indicá si querés guardar la nueva.',
    }),
  z
    .object({
      action: z.literal('confirm'),
      paymentAttemptId: z.string().uuid(),
      paymentIntentId: z.string().trim().min(1).max(191),
    })
    .strict(),
  z
    .object({
      action: z.literal('cancel'),
      paymentAttemptId: z.string().uuid(),
      paymentIntentId: z.string().trim().min(1).max(191),
    })
    .strict(),
]);

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

function getStripeBillingContext() {
  const key = process.env.DEVELOPER_STRIPE_SECRET_KEY?.trim();
  const environment =
    process.env.STRIPE_ENVIRONMENT?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'invalid' : 'sandbox');
  if (environment !== 'sandbox' || !key?.startsWith('sk_test_')) return null;
  return { key, scope: getStripeSavedCardScope(key), stripe: new Stripe(key) };
}

function billingError(error: unknown) {
  if (!(error instanceof ProPlanBillingError)) return null;
  const status =
    error.code === 'STOREFRONT_CLOSED'
      ? 409
      : error.code === 'PRO_ALREADY_ACTIVE'
        ? 409
        : error.code === 'PRO_PAYMENT_PENDING'
          ? 409
          : error.code === 'PAYMENT_ATTEMPT_OWNER_MISMATCH'
            ? 403
            : 400;
  return errorResponse(error.code, status);
}

export async function POST(request: Request) {
  try {
    const admin = await requireDashboardAdmin();
    const adminUserId = admin.user.id;
    if (!adminUserId) return errorResponse('ADMIN_ID_MISSING', 401);

    const parsed = StripeProRequestSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse('INVALID_REQUEST', 400);
    const context = getStripeBillingContext();
    if (!context) return errorResponse('STRIPE_BILLING_SANDBOX_UNAVAILABLE', 503);

    if (parsed.data.action === 'prepare') {
      const input = parsed.data;
      const existingAttempt = await findProPaymentAttempt(input.paymentAttemptId);
      if (existingAttempt) {
        if (
          existingAttempt.adminUserId !== adminUserId ||
          existingAttempt.paymentProvider !== 'STRIPE'
        ) {
          return errorResponse('PAYMENT_ATTEMPT_OWNER_MISMATCH', 403);
        }
        if (existingAttempt.status === 'PAID') {
          const current = await prisma.storeSubscription.findUnique({
            where: { id: 'default' },
            select: { storefrontStatus: true, planType: true, nextPaymentAt: true },
          });
          if (
            current?.storefrontStatus === 'OPEN' &&
            current.planType === 'PRO' &&
            current.nextPaymentAt &&
            current.nextPaymentAt.getTime() > Date.now()
          ) {
            return NextResponse.json({ alreadyPaid: true, activated: true }, { headers: NO_STORE });
          }
          return errorResponse('PAYMENT_ALREADY_RECORDED_CHECK_PLAN', 409);
        }
        if (existingAttempt.status === 'FAILED')
          return errorResponse('PAYMENT_ATTEMPT_ALREADY_FAILED', 409);
        if (existingAttempt.externalPaymentId) {
          const existingIntent = await context.stripe.paymentIntents.retrieve(
            existingAttempt.externalPaymentId,
          );
          if (
            existingIntent.status === 'succeeded' &&
            existingIntent.amount === PRICE_MINOR &&
            existingIntent.currency.toLowerCase() === 'ars' &&
            !existingIntent.livemode &&
            existingIntent.metadata.adminUserId === adminUserId &&
            existingIntent.metadata.paymentAttemptId === input.paymentAttemptId
          ) {
            const completed = await completeRegisteredProPayment({
              adminUserId,
              provider: 'STRIPE',
              paymentAttemptId: input.paymentAttemptId,
              providerTransactionId: existingIntent.id,
            });
            if (!completed.activated)
              return errorResponse('PAYMENT_RECORDED_STOREFRONT_CLOSED', 409);
            return NextResponse.json({ alreadyPaid: true, activated: true }, { headers: NO_STORE });
          }
          if (existingIntent.status !== 'canceled' && existingIntent.client_secret) {
            return NextResponse.json(
              {
                clientSecret: existingIntent.client_secret,
                paymentIntentId: existingIntent.id,
                paymentAttemptId: input.paymentAttemptId,
                useSavedCard:
                  Boolean(existingAttempt.paymentMethodRef) ||
                  (existingIntent.status === 'requires_action' &&
                    Boolean(existingIntent.payment_method)),
                amountARS: PRICE_ARS,
                currency: 'ARS',
              },
              { headers: NO_STORE },
            );
          }
          await failRegisteredProPayment({
            adminUserId,
            provider: 'STRIPE',
            paymentAttemptId: input.paymentAttemptId,
          });
          return errorResponse('PAYMENT_ATTEMPT_ALREADY_FAILED', 409);
        }
      }

      const subscription = await assertProPlanCanBePurchased();
      let customerId: string | undefined;
      let paymentMethodId: string | undefined;
      if (input.savedPaymentMethodId) {
        const savedCard = await prisma.savedPaymentMethod.findFirst({
          where: {
            id: input.savedPaymentMethodId,
            paymentCustomer: {
              userId: adminUserId,
              provider: 'STRIPE',
              accountScope: context.scope,
            },
          },
          include: { paymentCustomer: true },
        });
        if (!savedCard) return errorResponse('SAVED_CARD_NOT_FOUND', 404);
        const remoteCard = await context.stripe.paymentMethods.retrieve(savedCard.externalCardId);
        const attachedCustomerId =
          typeof remoteCard.customer === 'string' ? remoteCard.customer : remoteCard.customer?.id;
        if (
          remoteCard.type !== 'card' ||
          attachedCustomerId !== savedCard.paymentCustomer.externalCustomerId
        ) {
          return errorResponse('SAVED_CARD_NOT_AVAILABLE', 409);
        }
        customerId = savedCard.paymentCustomer.externalCustomerId;
        paymentMethodId = remoteCard.id;
      } else if (input.savePaymentMethod) {
        const customer = await getOrCreateStripePaymentCustomer(
          context.stripe,
          admin.user,
          context.key,
        );
        customerId = customer.localCustomer.externalCustomerId;
      }

      // A previous attempt may have timed out while Stripe kept an uncaptured intent alive.
      if (subscription.pendingProPaymentId && subscription.pendingProPaymentProvider === 'STRIPE') {
        if (
          subscription.pendingProPaymentExpiresAt &&
          subscription.pendingProPaymentExpiresAt.getTime() <= Date.now()
        ) {
          try {
            const oldIntent = await context.stripe.paymentIntents.retrieve(
              subscription.pendingProPaymentId,
            );
            if (oldIntent.status === 'succeeded')
              return errorResponse('PAYMENT_ALREADY_COMPLETED', 409);
            if (
              ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(
                oldIntent.status,
              )
            ) {
              await context.stripe.paymentIntents.cancel(oldIntent.id);
            } else {
              return errorResponse('PRO_PAYMENT_PENDING', 409);
            }
          } catch {
            return errorResponse('PRO_PAYMENT_PENDING', 409);
          }
        } else {
          return errorResponse('PRO_PAYMENT_PENDING', 409);
        }
      }

      const intent = await context.stripe.paymentIntents.create(
        {
          amount: PRICE_MINOR,
          currency: 'ars',
          payment_method_types: ['card'],
          ...(customerId ? { customer: customerId } : {}),
          ...(paymentMethodId ? { payment_method: paymentMethodId } : {}),
          ...(!input.savedPaymentMethodId && input.savePaymentMethod
            ? { setup_future_usage: 'on_session' as const }
            : {}),
          metadata: {
            adminUserId,
            subscriptionId: 'default',
            planType: 'PRO',
            billingAmountARS: String(PRICE_ARS),
            paymentAttemptId: input.paymentAttemptId,
          },
        },
        { idempotencyKey: 'pro-plan-' + adminUserId + '-' + input.paymentAttemptId },
      );

      if (!intent.client_secret || intent.livemode) {
        try {
          await context.stripe.paymentIntents.cancel(intent.id);
        } catch {}
        return errorResponse('STRIPE_PAYMENT_INTENT_INVALID', 502);
      }

      try {
        await registerPendingProPayment({
          adminUserId,
          provider: 'STRIPE',
          externalPaymentId: intent.id,
          paymentAttemptId: input.paymentAttemptId,
          paymentAmount: PRICE_ARS,
          paymentCurrency: 'ARS',
          exchangeRate: 1,
          expiresAt: new Date(Date.now() + 15 * 60_000),
          savedPaymentMethodId: input.savedPaymentMethodId ?? null,
        });
        await prisma.storeSubscriptionPayment.update({
          where: { paymentAttemptId: input.paymentAttemptId },
          data: { stripePaymentIntentId: intent.id },
        });
      } catch (error) {
        try {
          const current = await context.stripe.paymentIntents.retrieve(intent.id);
          if (
            ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(
              current.status,
            )
          ) {
            await context.stripe.paymentIntents.cancel(intent.id);
          }
        } catch {}
        const response = billingError(error);
        if (response) return response;
        throw error;
      }

      return NextResponse.json(
        {
          clientSecret: intent.client_secret,
          paymentIntentId: intent.id,
          paymentAttemptId: input.paymentAttemptId,
          useSavedCard: Boolean(input.savedPaymentMethodId),
          amountARS: PRICE_ARS,
          currency: 'ARS',
        },
        { headers: NO_STORE },
      );
    }

    const { paymentAttemptId, paymentIntentId } = parsed.data;
    const payment = await findProPaymentAttempt(paymentAttemptId);
    if (
      !payment ||
      payment.adminUserId !== adminUserId ||
      payment.paymentProvider !== 'STRIPE' ||
      payment.externalPaymentId !== paymentIntentId
    ) {
      return errorResponse('PRO_PAYMENT_NOT_FOUND', 404);
    }

    const intent = await context.stripe.paymentIntents.retrieve(paymentIntentId);
    if (parsed.data.action === 'cancel') {
      if (intent.status === 'succeeded') {
        const completed = await completeRegisteredProPayment({
          adminUserId,
          provider: 'STRIPE',
          paymentAttemptId,
          providerTransactionId: intent.id,
        });
        return completed.activated
          ? NextResponse.json({ alreadyPaid: true, activated: true }, { headers: NO_STORE })
          : errorResponse('PAYMENT_RECORDED_STOREFRONT_CLOSED', 409);
      }
      if (
        ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(
          intent.status,
        )
      ) {
        await context.stripe.paymentIntents.cancel(intent.id);
      } else if (intent.status !== 'canceled') {
        return errorResponse('PAYMENT_CANNOT_BE_CANCELLED', 409);
      }
      await failRegisteredProPayment({ adminUserId, provider: 'STRIPE', paymentAttemptId });
      return NextResponse.json({ cancelled: true }, { headers: NO_STORE });
    }
    if (
      intent.livemode ||
      intent.status !== 'succeeded' ||
      intent.amount !== PRICE_MINOR ||
      intent.currency.toLowerCase() !== 'ars' ||
      intent.metadata.adminUserId !== adminUserId ||
      intent.metadata.subscriptionId !== 'default' ||
      intent.metadata.planType !== 'PRO' ||
      intent.metadata.billingAmountARS !== String(PRICE_ARS) ||
      intent.metadata.paymentAttemptId !== paymentAttemptId
    ) {
      return errorResponse('STRIPE_PAYMENT_NOT_CONFIRMED', 409);
    }

    const result = await completeRegisteredProPayment({
      adminUserId,
      provider: 'STRIPE',
      paymentAttemptId,
      providerTransactionId: intent.id,
    });

    if (!result.activated && result.storefrontClosed) {
      return errorResponse('PAYMENT_RECORDED_STOREFRONT_CLOSED', 409);
    }
    return NextResponse.json(
      {
        success: true,
        activated: result.activated,
        alreadyProcessed: result.alreadyProcessed,
        paidThrough: result.paidThrough.toISOString(),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    const response = billingError(error);
    if (response) return response;
    console.error(
      '[pro-payment-stripe] failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return errorResponse('STRIPE_PRO_PAYMENT_FAILED', 502);
  }
}
