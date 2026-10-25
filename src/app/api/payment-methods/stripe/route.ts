import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { stripePaymentConfig } from '@/lib/payments/platform-config';
import {
  getOrCreateStripePaymentCustomer,
  getStripeSavedCardScope,
  syncStripeSavedCards,
} from '@/lib/payments/stripe-saved-cards';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };
const DeleteCardSchema = z
  .object({ savedPaymentMethodId: z.string().trim().min(1).max(191) })
  .strict();

async function getStripeContext() {
  const config = await stripePaymentConfig();
  if (
    !config.secretKey ||
    !config.connectedAccountId ||
    !config.splitEnabled ||
    config.sandbox !== true
  ) {
    return null;
  }
  return {
    ...config,
    stripe: new Stripe(config.secretKey),
    accountScope: getStripeSavedCardScope(config.secretKey),
  };
}

function responseError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return responseError('Debés iniciar sesión para consultar tus tarjetas.', 401);

    const rateLimit = checkRateLimit(`stripe-saved-cards-read:${hashRateLimitIdentity(user.id)}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed)
      return responseError('Demasiadas consultas. Volvé a intentar en un minuto.', 429);

    const context = await getStripeContext();
    if (!context)
      return responseError(
        'El guardado de tarjetas de Stripe está disponible en el entorno sandbox configurado.',
        503,
      );

    const existing = await prisma.paymentCustomer.findUnique({
      where: {
        userId_provider_accountScope: {
          userId: user.id,
          provider: 'STRIPE',
          accountScope: context.accountScope,
        },
      },
    });
    if (!existing) return NextResponse.json({ cards: [] }, { headers: NO_STORE_HEADERS });

    const { localCustomer } = await getOrCreateStripePaymentCustomer(
      context.stripe,
      user,
      context.secretKey!,
    );
    const cards = await syncStripeSavedCards(
      context.stripe,
      localCustomer.id,
      localCustomer.externalCustomerId,
    );
    return NextResponse.json({ cards }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error(
      '[stripe-saved-cards] list failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return responseError('No se pudieron consultar tus tarjetas guardadas.', 502);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return responseError('Debés iniciar sesión para quitar una tarjeta.', 401);

    const rateLimit = checkRateLimit(
      `stripe-saved-cards-delete:${hashRateLimitIdentity(user.id)}`,
      { limit: 10, windowMs: 60_000 },
    );
    if (!rateLimit.allowed)
      return responseError('Demasiados intentos. Volvé a intentar en un minuto.', 429);

    const parsed = DeleteCardSchema.safeParse(await request.json());
    if (!parsed.success) return responseError('La tarjeta seleccionada no es válida.', 400);

    const context = await getStripeContext();
    if (!context)
      return responseError(
        'El guardado de tarjetas de Stripe está disponible en el entorno sandbox configurado.',
        503,
      );

    const card = await prisma.savedPaymentMethod.findFirst({
      where: {
        id: parsed.data.savedPaymentMethodId,
        paymentCustomer: {
          userId: user.id,
          provider: 'STRIPE',
          accountScope: context.accountScope,
        },
      },
      include: { paymentCustomer: true },
    });
    if (!card) return responseError('La tarjeta no pertenece a tu cuenta.', 404);

    const paymentMethod = await context.stripe.paymentMethods.retrieve(card.externalCardId);
    const attachedCustomerId =
      typeof paymentMethod.customer === 'string'
        ? paymentMethod.customer
        : paymentMethod.customer?.id;
    if (
      paymentMethod.type !== 'card' ||
      attachedCustomerId !== card.paymentCustomer.externalCustomerId
    ) {
      return responseError('La tarjeta ya no está asociada a tu cuenta de Stripe.', 409);
    }

    await context.stripe.paymentMethods.detach(paymentMethod.id);
    await prisma.savedPaymentMethod.delete({ where: { id: card.id } });
    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error(
      '[stripe-saved-cards] delete failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return responseError('No se pudo quitar la tarjeta guardada.', 502);
  }
}
