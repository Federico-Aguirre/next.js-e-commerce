import { NextResponse } from 'next/server';
import StripeSDK from 'stripe';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { sendLowStockAlerts, sendPaidOrderAlert } from '@/lib/order-alerts';
import { sendOrderConfirmationEmail } from '@/lib/orders/order-confirmation-email';
import {
  refreshPlatformSubscriptionPlan,
  stripePaymentConfig,
} from '@/lib/payments/platform-config';
import { getStripeSavedCardScope, syncStripeSavedCards } from '@/lib/payments/stripe-saved-cards';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

const ConfirmStripeSchema = z
  .object({
    paymentIntentId: z.string().trim().min(1).max(255),
    orderId: z.string().trim().min(1).max(191),
  })
  .strict();

function privateNoStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return privateNoStoreJson(
      { message: 'Debés iniciar sesión para confirmar la compra.' },
      { status: 401 },
    );
  }

  const rateLimit = checkRateLimit('stripe-confirm:' + hashRateLimitIdentity(user.id), {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return privateNoStoreJson(
      { message: 'Demasiadas verificaciones. Volvé a intentar en un minuto.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  try {
    const parsed = ConfirmStripeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return privateNoStoreJson(
        { message: 'Faltan datos válidos para confirmar la compra.' },
        { status: 400 },
      );
    }

    const { paymentIntentId, orderId } = parsed.data;
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.id,
        paymentProvider: 'STRIPE',
        paymentExternalId: paymentIntentId,
      },
    });

    if (!order) {
      return privateNoStoreJson(
        { message: 'No se encontró una reserva propia asociada a este pago.' },
        { status: 404 },
      );
    }

    const { secretKey } = await stripePaymentConfig();
    if (!secretKey) {
      return privateNoStoreJson(
        { message: 'Stripe no está configurado en el servidor.' },
        { status: 503 },
      );
    }

    const stripe = new StripeSDK(secretKey);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.metadata.orderId !== order.id || paymentIntent.metadata.userId !== user.id) {
      return privateNoStoreJson(
        { message: 'El pago no coincide con la reserva autenticada.' },
        { status: 403 },
      );
    }

    const expectedAmount = Math.round((order.paymentTotal ?? order.total) * 100);
    if (
      paymentIntent.amount !== expectedAmount ||
      paymentIntent.currency.toUpperCase() !== order.paymentCurrency.toUpperCase()
    ) {
      return privateNoStoreJson(
        { message: 'El importe o la moneda del pago no coinciden con la reserva.' },
        { status: 409 },
      );
    }

    if (paymentIntent.status !== 'succeeded') {
      return privateNoStoreJson(
        { message: 'Stripe todavía no informa un pago completado.' },
        { status: 409 },
      );
    }

    // Run card synchronization only after the order is durably marked paid, so a slow
    // Stripe list request cannot make a successful payment miss the order expiry check.
    const syncSavedCardsForCurrentUser = async () => {
      const externalCustomerId =
        typeof paymentIntent.customer === 'string'
          ? paymentIntent.customer
          : paymentIntent.customer?.id;
      if (!externalCustomerId) return;

      try {
        const accountScope = getStripeSavedCardScope(secretKey);
        const localCustomer = await prisma.paymentCustomer.findUnique({
          where: {
            userId_provider_accountScope: {
              userId: user.id,
              provider: 'STRIPE',
              accountScope,
            },
          },
        });
        if (localCustomer?.externalCustomerId === externalCustomerId) {
          await syncStripeSavedCards(stripe, localCustomer.id, externalCustomerId);
        }
      } catch (syncError) {
        // A successful payment must remain confirmed even if card metadata sync fails.
        console.error(
          '[stripe-confirm] saved-card sync failed:',
          syncError instanceof Error ? syncError.name : 'UnknownError',
        );
      }
    };

    if (order.status === 'PAID') {
      await syncSavedCardsForCurrentUser();
      await sendOrderConfirmationEmail(order.id);
      return privateNoStoreJson({
        success: true,
        orderId: order.id,
        alreadyConfirmed: true,
      });
    }

    if (order.status !== 'PENDING' || order.expiresAt.getTime() <= Date.now()) {
      return privateNoStoreJson(
        { message: 'La reserva ya no está disponible para confirmar.' },
        { status: 409 },
      );
    }

    const updated = await prisma.order.updateMany({
      where: {
        id: order.id,
        userId: user.id,
        status: 'PENDING',
        paymentProvider: 'STRIPE',
        paymentExternalId: paymentIntent.id,
        expiresAt: { gt: new Date() },
      },
      data: { status: 'PAID' },
    });

    if (updated.count !== 1) {
      const current = await prisma.order.findFirst({
        where: { id: order.id, userId: user.id },
        select: { id: true, status: true, paymentExternalId: true },
      });
      if (current?.status === 'PAID' && current.paymentExternalId === paymentIntent.id) {
        return privateNoStoreJson({
          success: true,
          orderId: current.id,
          alreadyConfirmed: true,
        });
      }
      return privateNoStoreJson(
        { message: 'La reserva cambió mientras se confirmaba el pago.' },
        { status: 409 },
      );
    }

    await syncSavedCardsForCurrentUser();
    await refreshPlatformSubscriptionPlan();

    await Promise.allSettled([
      sendOrderConfirmationEmail(order.id),
      sendPaidOrderAlert(order.id),
      sendLowStockAlerts(),
    ]);

    return privateNoStoreJson({ success: true, orderId: order.id });
  } catch (error) {
    console.error('[stripe-confirm] failed:', error instanceof Error ? error.name : 'UnknownError');
    return privateNoStoreJson(
      { message: 'No se pudo verificar el pago en este momento.' },
      { status: 502 },
    );
  }
}
