import { connection, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { requireDashboardAdmin } from '@/app/[locale]/dashboard/data';
import { getDeveloperMercadoPagoSandboxContext } from '@/lib/payments/developer-mercadopago-sandbox';
import { getMercadoPagoSandboxCustomerEmail } from '@/lib/payments/mercadopago-saved-cards';
import {
  getLocalPayPalSavedCards,
  getPayPalSavedCardScope,
  getPayPalSandboxAccessToken,
  getPayPalVaultHeaders,
  persistPayPalVaultCard,
} from '@/lib/payments/paypal-saved-cards';
import {
  getOrCreateStripePaymentCustomer,
  getStripeSavedCardScope,
  syncStripeSavedCards,
} from '@/lib/payments/stripe-saved-cards';
import { prisma } from '@/lib/prisma';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const SaveMercadoPagoCardSchema = z
  .object({
    provider: z.literal('MERCADOPAGO'),
    token: z.string().trim().min(1).max(8192),
  })
  .strict();

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

function getPayPalBillingContext() {
  const environment =
    process.env.PAYPAL_ENVIRONMENT?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'invalid' : 'sandbox');
  const clientId = process.env.DEVELOPER_PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.DEVELOPER_PAYPAL_CLIENT_SECRET?.trim();
  const merchantId = process.env.DEVELOPER_PAYPAL_MERCHANT_ID?.trim();
  const partnerAttributionId = process.env.DEVELOPER_PAYPAL_PARTNER_ATTRIBUTION_ID?.trim();
  if (
    environment !== 'sandbox' ||
    !clientId ||
    !clientSecret ||
    !merchantId ||
    !partnerAttributionId
  )
    return null;
  const config = {
    clientId,
    clientSecret,
    sellerMerchantId: merchantId,
    partnerAttributionId,
    splitEnabled: true,
    sandbox: true,
  };
  return { config, merchantId, scope: getPayPalSavedCardScope(merchantId) };
}

async function getMercadoPagoBillingContext() {
  const context = await getDeveloperMercadoPagoSandboxContext();
  return context ? { accessToken: context.accessToken, scope: context.accountScope } : null;
}

type MercadoPagoCard = {
  id?: string | number;
  last_four_digits?: string;
  expiration_month?: number;
  expiration_year?: number;
  payment_method?: { id?: string; name?: string; payment_type_id?: string };
};

async function mercadoPagoApi<T>(
  accessToken: string,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
) {
  const response = await fetch('https://api.mercadopago.com' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  return { status: response.status, data: (await response.json().catch(() => ({}))) as T };
}

export async function GET(request: Request) {
  await connection();
  try {
    const admin = await requireDashboardAdmin();
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider')?.toUpperCase();
    if (!['STRIPE', 'PAYPAL', 'MERCADOPAGO'].includes(provider ?? ''))
      return errorResponse('Proveedor de pago inválido.', 400);
    const userId = admin.user.id;
    if (!userId) return errorResponse('No se pudo identificar al administrador.', 401);

    if (provider === 'STRIPE') {
      const context = getStripeBillingContext();
      if (!context) return NextResponse.json({ cards: [] }, { headers: NO_STORE });
      const existing = await prisma.paymentCustomer.findUnique({
        where: {
          userId_provider_accountScope: { userId, provider: 'STRIPE', accountScope: context.scope },
        },
      });
      if (!existing) return NextResponse.json({ cards: [] }, { headers: NO_STORE });
      const customer = await getOrCreateStripePaymentCustomer(
        context.stripe,
        admin.user,
        context.key,
      );
      const cards = await syncStripeSavedCards(
        context.stripe,
        customer.localCustomer.id,
        customer.localCustomer.externalCustomerId,
      );
      return NextResponse.json({ cards }, { headers: NO_STORE });
    }

    if (provider === 'PAYPAL') {
      const context = getPayPalBillingContext();
      if (!context) return NextResponse.json({ cards: [] }, { headers: NO_STORE });
      const current = await getLocalPayPalSavedCards(userId, context.scope);
      if (!current.customer) return NextResponse.json({ cards: [] }, { headers: NO_STORE });
      try {
        const accessToken = await getPayPalSandboxAccessToken(context.config);
        const response = await fetch(
          'https://api-m.sandbox.paypal.com/v3/vault/payment-tokens?customer_id=' +
            encodeURIComponent(current.customer.externalCustomerId),
          {
            headers: getPayPalVaultHeaders(context.config, accessToken),
            cache: 'no-store',
          },
        );
        const data = (await response.json().catch(() => ({}))) as {
          payment_tokens?: Array<{
            id?: string;
            customer?: { id?: string };
            payment_source?: { card?: { brand?: string; last_digits?: string; expiry?: string } };
          }>;
        };
        if (response.ok && Array.isArray(data.payment_tokens)) {
          for (const token of data.payment_tokens) {
            if (
              !token.id ||
              (token.customer?.id && token.customer.id !== current.customer.externalCustomerId)
            )
              continue;
            const card = token.payment_source?.card;
            await persistPayPalVaultCard({
              userId,
              sellerMerchantId: context.merchantId,
              card: {
                id: token.id,
                customerId: token.customer?.id || current.customer.externalCustomerId,
                brand: card?.brand,
                lastDigits: card?.last_digits,
                expiry: card?.expiry,
              },
            });
          }
        }
      } catch (error) {
        console.error(
          '[pro-payment-cards] PayPal refresh failed:',
          error instanceof Error ? error.name : 'UnknownError',
        );
      }
      const refreshed = await getLocalPayPalSavedCards(userId, context.scope);
      return NextResponse.json({ cards: refreshed.cards }, { headers: NO_STORE });
    }

    const context = await getMercadoPagoBillingContext();
    if (!context) return NextResponse.json({ cards: [] }, { headers: NO_STORE });
    const customer = await prisma.paymentCustomer.findUnique({
      where: {
        userId_provider_accountScope: {
          userId,
          provider: 'MERCADOPAGO',
          accountScope: context.scope,
        },
      },
      include: { cards: { orderBy: { createdAt: 'desc' } } },
    });
    if (!customer) return NextResponse.json({ cards: [] }, { headers: NO_STORE });
    const remote = await mercadoPagoApi<MercadoPagoCard[]>(
      context.accessToken,
      '/v1/customers/' + encodeURIComponent(customer.externalCustomerId) + '/cards',
      'GET',
    );
    if (remote.status >= 200 && remote.status < 300 && Array.isArray(remote.data)) {
      const valid = remote.data.filter((card) => card.id !== undefined && card.id !== null);
      const ids = valid.map((card) => String(card.id));
      await prisma.savedPaymentMethod.deleteMany({
        where: {
          paymentCustomerId: customer.id,
          ...(ids.length ? { externalCardId: { notIn: ids } } : {}),
        },
      });
      for (const card of valid) {
        const cardId = String(card.id);
        const methodId = card.payment_method?.id;
        if (!methodId) continue;
        const updateData = {
          paymentMethodId: methodId,
          paymentType: card.payment_method?.payment_type_id ?? null,
          paymentMethodName: card.payment_method?.name ?? methodId,
          lastFourDigits: /^\d{4}$/.test(card.last_four_digits ?? '')
            ? card.last_four_digits!
            : null,
          expirationMonth: Number.isInteger(card.expiration_month) ? card.expiration_month! : null,
          expirationYear: Number.isInteger(card.expiration_year) ? card.expiration_year! : null,
        };
        await prisma.savedPaymentMethod.upsert({
          where: {
            paymentCustomerId_externalCardId: {
              paymentCustomerId: customer.id,
              externalCardId: cardId,
            },
          },
          create: { paymentCustomerId: customer.id, externalCardId: cardId, ...updateData },
          update: updateData,
        });
      }
    }
    const cards = await prisma.savedPaymentMethod.findMany({
      where: { paymentCustomerId: customer.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        externalCardId: true,
        paymentMethodId: true,
        paymentMethodName: true,
        lastFourDigits: true,
        expirationMonth: true,
        expirationYear: true,
      },
    });
    return NextResponse.json(
      {
        cards: cards.map((card) => ({
          id: card.id,
          cardId: card.externalCardId,
          paymentMethodId: card.paymentMethodId,
          brand: card.paymentMethodName || 'Tarjeta',
          lastFourDigits: card.lastFourDigits,
          expirationMonth: card.expirationMonth,
          expirationYear: card.expirationYear,
        })),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error(
      '[pro-payment-cards] list failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return errorResponse('No se pudieron cargar las tarjetas guardadas para este proveedor.', 502);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireDashboardAdmin();
    const userId = admin.user.id;
    if (!userId) return errorResponse('No se pudo identificar al administrador.', 401);
    const parsed = SaveMercadoPagoCardSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse('Token de tarjeta inválido.', 400);
    const context = await getMercadoPagoBillingContext();
    if (!context)
      return errorResponse(
        'Mercado Pago no tiene configurada la cuenta receptora sandbox para los abonos Pro.',
        503,
      );

    let customer = await prisma.paymentCustomer.findUnique({
      where: {
        userId_provider_accountScope: {
          userId,
          provider: 'MERCADOPAGO',
          accountScope: context.scope,
        },
      },
    });
    if (!customer) {
      const customerEmail = getMercadoPagoSandboxCustomerEmail(userId);
      const currentAdmin = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const created = await mercadoPagoApi<{ id?: string } | { message?: string; error?: string }>(
        context.accessToken,
        '/v1/customers',
        'POST',
        {
          email: customerEmail,
          ...(currentAdmin?.firstName ? { first_name: currentAdmin.firstName } : {}),
          ...(currentAdmin?.lastName ? { last_name: currentAdmin.lastName } : {}),
        },
      );
      if (
        created.status < 200 ||
        created.status >= 300 ||
        !('id' in created.data) ||
        !created.data.id
      ) {
        return errorResponse(
          'Mercado Pago no pudo preparar la bóveda de tarjetas de la cuenta receptora.',
          502,
        );
      }
      customer = await prisma.paymentCustomer.create({
        data: {
          userId,
          provider: 'MERCADOPAGO',
          accountScope: context.scope,
          externalCustomerId: String(created.data.id),
        },
      });
    }

    const saved = await mercadoPagoApi<MercadoPagoCard & { message?: string; error?: string }>(
      context.accessToken,
      '/v1/customers/' + encodeURIComponent(customer.externalCustomerId) + '/cards',
      'POST',
      { token: parsed.data.token },
    );
    if (
      saved.status < 200 ||
      saved.status >= 300 ||
      saved.data.id == null ||
      !saved.data.payment_method?.id
    ) {
      return errorResponse(
        'Mercado Pago no pudo guardar la tarjeta para usarla con el abono Pro.',
        502,
      );
    }

    const externalCardId = String(saved.data.id);
    const updateData = {
      paymentMethodId: saved.data.payment_method.id,
      paymentType: saved.data.payment_method.payment_type_id ?? null,
      paymentMethodName: saved.data.payment_method.name ?? saved.data.payment_method.id,
      lastFourDigits: /^\d{4}$/.test(saved.data.last_four_digits ?? '')
        ? saved.data.last_four_digits!
        : null,
      expirationMonth: Number.isInteger(saved.data.expiration_month)
        ? saved.data.expiration_month!
        : null,
      expirationYear: Number.isInteger(saved.data.expiration_year)
        ? saved.data.expiration_year!
        : null,
    };
    const card = await prisma.savedPaymentMethod.upsert({
      where: {
        paymentCustomerId_externalCardId: { paymentCustomerId: customer.id, externalCardId },
      },
      create: { paymentCustomerId: customer.id, externalCardId, ...updateData },
      update: updateData,
    });
    return NextResponse.json(
      {
        card: {
          id: card.id,
          brand: card.paymentMethodName || 'Tarjeta',
          lastFourDigits: card.lastFourDigits,
          expirationMonth: card.expirationMonth,
          expirationYear: card.expirationYear,
        },
      },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    console.error(
      '[pro-payment-cards] save failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return errorResponse('No se pudo guardar la tarjeta para el abono Pro.', 502);
  }
}
