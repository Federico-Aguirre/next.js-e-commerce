import 'server-only';
import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

type StripeSavedCardUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export function getStripeSavedCardScope(secretKey: string) {
  const fingerprint = createHash('sha256').update(secretKey).digest('hex').slice(0, 24);
  return `sandbox-key-${fingerprint}`;
}

export function getStripeCardBrandLabel(brand?: string | null) {
  const raw = (brand || 'Tarjeta').trim();
  if (!raw) return 'Tarjeta';
  return raw.slice(0, 1).toLocaleUpperCase('es-AR') + raw.slice(1).toLocaleLowerCase('es-AR');
}

function isMissingStripeResource(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; type?: unknown };
  return candidate.code === 'resource_missing' && candidate.type === 'StripeInvalidRequestError';
}

export async function getOrCreateStripePaymentCustomer(
  stripe: Stripe,
  user: StripeSavedCardUser,
  secretKey: string,
) {
  if (!secretKey.startsWith('sk_test_')) {
    throw new Error('El guardado de tarjetas de Stripe solo está habilitado en sandbox.');
  }

  const accountScope = getStripeSavedCardScope(secretKey);
  const where = {
    userId_provider_accountScope: {
      userId: user.id,
      provider: 'STRIPE',
      accountScope,
    },
  };
  const existing = await prisma.paymentCustomer.findUnique({ where });

  if (existing) {
    try {
      const remote = await stripe.customers.retrieve(existing.externalCustomerId);
      if ('deleted' in remote && remote.deleted) {
        // Create a fresh Stripe customer below and replace this stale identifier.
      } else {
        if (remote.metadata?.userId && remote.metadata.userId !== user.id) {
          throw new Error('El Customer de Stripe no pertenece al usuario autenticado.');
        }
        return { localCustomer: existing, accountScope };
      }
    } catch (error) {
      if (!isMissingStripeResource(error)) throw error;
    }

    await prisma.savedPaymentMethod.deleteMany({ where: { paymentCustomerId: existing.id } });
  }

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.name || undefined;
  const externalCustomer = await stripe.customers.create(
    {
      ...(user.email ? { email: user.email } : {}),
      ...(fullName ? { name: fullName } : {}),
      metadata: { userId: user.id, app: 'nextjs-e-commerce' },
    },
    {
      idempotencyKey: `saved-card-customer-${accountScope}-${user.id}-${existing ? `replacement-${Date.now()}` : 'primary'}`,
    },
  );

  const localCustomer = await prisma.paymentCustomer.upsert({
    where,
    create: {
      userId: user.id,
      provider: 'STRIPE',
      accountScope,
      externalCustomerId: externalCustomer.id,
    },
    update: { externalCustomerId: externalCustomer.id },
  });

  return { localCustomer, accountScope };
}

export async function syncStripeSavedCards(
  stripe: Stripe,
  localCustomerId: string,
  externalCustomerId: string,
) {
  const response = await stripe.paymentMethods.list({ customer: externalCustomerId, type: 'card' });
  const cards = response.data.filter((method) => method.type === 'card' && method.card);
  const remoteIds = cards.map((method) => method.id);

  await prisma.savedPaymentMethod.deleteMany({
    where: {
      paymentCustomerId: localCustomerId,
      ...(remoteIds.length ? { externalCardId: { notIn: remoteIds } } : {}),
    },
  });

  for (const method of cards) {
    if (!method.card) continue;
    await prisma.savedPaymentMethod.upsert({
      where: {
        paymentCustomerId_externalCardId: {
          paymentCustomerId: localCustomerId,
          externalCardId: method.id,
        },
      },
      create: {
        paymentCustomerId: localCustomerId,
        externalCardId: method.id,
        paymentMethodId: 'card',
        paymentType: 'card',
        paymentMethodName: method.card.display_brand || method.card.brand || 'Tarjeta',
        lastFourDigits: /^\d{4}$/.test(method.card.last4 || '') ? method.card.last4 : null,
        expirationMonth: method.card.exp_month,
        expirationYear: method.card.exp_year,
      },
      update: {
        paymentMethodId: 'card',
        paymentType: 'card',
        paymentMethodName: method.card.display_brand || method.card.brand || 'Tarjeta',
        lastFourDigits: /^\d{4}$/.test(method.card.last4 || '') ? method.card.last4 : null,
        expirationMonth: method.card.exp_month,
        expirationYear: method.card.exp_year,
      },
    });
  }

  const savedCards = await prisma.savedPaymentMethod.findMany({
    where: { paymentCustomerId: localCustomerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      externalCardId: true,
      paymentMethodName: true,
      lastFourDigits: true,
      expirationMonth: true,
      expirationYear: true,
    },
  });

  return savedCards.map((card) => ({
    id: card.id,
    brand: getStripeCardBrandLabel(card.paymentMethodName),
    lastFourDigits: card.lastFourDigits,
    expirationMonth: card.expirationMonth,
    expirationYear: card.expirationYear,
  }));
}
