import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { stripePaymentConfig } from '@/lib/payments/platform-config';
import {
  getOrCreateStripePaymentCustomer,
  getStripeSavedCardScope,
} from '@/lib/payments/stripe-saved-cards';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };
const PreparePaymentSchema = z
  .object({
    paymentIntentId: z.string().trim().min(1).max(255),
    orderId: z.string().trim().min(1).max(191),
    savePaymentMethod: z.boolean().optional().default(false),
    savedPaymentMethodId: z.string().trim().min(1).max(191).optional(),
  })
  .strict()
  .refine((value) => !(value.savePaymentMethod && value.savedPaymentMethodId), {
    message: 'Elegí guardar una tarjeta nueva o usar una tarjeta guardada, no ambas opciones.',
  });

function responseError(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return responseError('Debés iniciar sesión para preparar el pago.', 401);

  const rateLimit = checkRateLimit(`stripe-prepare:${hashRateLimitIdentity(user.id)}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed)
    return responseError('Demasiados intentos de pago. Volvé a intentar en un minuto.', 429);

  try {
    const parsed = PreparePaymentSchema.safeParse(await request.json());
    if (!parsed.success) return responseError('Los datos del pago no son válidos.', 400);

    const { paymentIntentId, orderId, savePaymentMethod, savedPaymentMethodId } = parsed.data;
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.id,
        paymentProvider: 'STRIPE',
        paymentExternalId: paymentIntentId,
      },
    });
    if (!order)
      return responseError('No se encontró una reserva propia asociada a este pago.', 404);
    if (order.status !== 'PENDING' || order.expiresAt.getTime() <= Date.now()) {
      return responseError(
        'La reserva venció o ya no puede pagarse. Iniciá un checkout nuevo.',
        409,
      );
    }

    const config = await stripePaymentConfig();
    if (
      !config.secretKey ||
      !config.connectedAccountId ||
      !config.splitEnabled ||
      config.sandbox !== true
    ) {
      return responseError(
        'Stripe está bloqueado hasta que la cuenta Connect sandbox del comercio esté activa.',
        503,
      );
    }

    const stripe = new Stripe(config.secretKey);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.metadata.orderId !== order.id || paymentIntent.metadata.userId !== user.id) {
      return responseError('El pago no coincide con la reserva autenticada.', 403);
    }
    const expectedAmount = Math.round((order.paymentTotal ?? order.total) * 100);
    if (
      paymentIntent.amount !== expectedAmount ||
      paymentIntent.currency.toUpperCase() !== order.paymentCurrency.toUpperCase()
    ) {
      return responseError('El importe o la moneda del pago no coinciden con la reserva.', 409);
    }
    if (!['requires_payment_method', 'requires_confirmation'].includes(paymentIntent.status)) {
      return responseError('Este intento de pago ya no acepta cambios en la tarjeta.', 409);
    }

    const accountScope = getStripeSavedCardScope(config.secretKey);

    if (savedPaymentMethodId) {
      const savedCard = await prisma.savedPaymentMethod.findFirst({
        where: {
          id: savedPaymentMethodId,
          paymentCustomer: { userId: user.id, provider: 'STRIPE', accountScope },
        },
        include: { paymentCustomer: true },
      });
      if (!savedCard) return responseError('La tarjeta no pertenece a tu cuenta.', 404);

      const remotePaymentMethod = await stripe.paymentMethods.retrieve(savedCard.externalCardId);
      const attachedCustomerId =
        typeof remotePaymentMethod.customer === 'string'
          ? remotePaymentMethod.customer
          : remotePaymentMethod.customer?.id;
      if (
        remotePaymentMethod.type !== 'card' ||
        attachedCustomerId !== savedCard.paymentCustomer.externalCustomerId
      ) {
        return responseError('La tarjeta guardada ya no está disponible en Stripe.', 409);
      }

      await stripe.paymentIntents.update(paymentIntent.id, {
        customer: savedCard.paymentCustomer.externalCustomerId,
        payment_method: remotePaymentMethod.id,
      });
    } else if (savePaymentMethod) {
      const { localCustomer } = await getOrCreateStripePaymentCustomer(
        stripe,
        user,
        config.secretKey,
      );
      await stripe.paymentIntents.update(paymentIntent.id, {
        customer: localCustomer.externalCustomerId,
        setup_future_usage: 'on_session',
      });
    } else if (paymentIntent.setup_future_usage) {
      // If the buyer opted out after a failed attempt, clear the request to save the next card.
      await stripe.paymentIntents.update(paymentIntent.id, { setup_future_usage: '' });
    }

    return NextResponse.json({ ready: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('[stripe-prepare] failed:', error instanceof Error ? error.name : 'UnknownError');
    return responseError('No se pudo preparar el pago con Stripe.', 502);
  }
}
