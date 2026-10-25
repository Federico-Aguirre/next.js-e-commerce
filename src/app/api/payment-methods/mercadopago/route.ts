import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import {
  getMercadoPagoSandboxCustomerEmail,
  getMercadoPagoSavedCardScope,
} from '@/lib/payments/mercadopago-saved-cards';
import { mercadoPagoPaymentConfig } from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

type MercadoPagoCustomer = {
  id?: string;
  email?: string;
};

type MercadoPagoCard = {
  id?: string | number;
  first_six_digits?: string;
  last_four_digits?: string;
  expiration_month?: number;
  expiration_year?: number;
  payment_method?: {
    id?: string;
    name?: string;
    payment_type_id?: string;
  };
};

type MercadoPagoApiError = {
  message?: string;
  error?: string;
  cause?: Array<{ code?: string | number; description?: string }>;
};

async function mercadoPagoApi<T>(
  accessToken: string,
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
): Promise<{ status: number; requestId: string | null; data: T }> {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as T;
  return {
    status: response.status,
    requestId: response.headers.get('x-request-id'),
    data,
  };
}

function safeProviderError(data: unknown) {
  const error = data as MercadoPagoApiError;
  return {
    message: error?.message || error?.error || 'Error de la API de Mercado Pago.',
    code: error?.cause?.[0]?.code ?? null,
  };
}

function toPublicCard(card: {
  id: string;
  externalCardId: string;
  paymentMethodId: string;
  paymentType: string | null;
  paymentMethodName: string | null;
  lastFourDigits: string | null;
  expirationMonth: number | null;
  expirationYear: number | null;
}) {
  return {
    id: card.id,
    cardId: card.externalCardId,
    paymentMethodId: card.paymentMethodId,
    paymentType: card.paymentType,
    brand: card.paymentMethodName || card.paymentMethodId,
    lastFourDigits: card.lastFourDigits,
    expirationMonth: card.expirationMonth,
    expirationYear: card.expirationYear,
  };
}

async function getPaymentContext() {
  const config = await mercadoPagoPaymentConfig();
  if (!config.accessToken || !config.chargeEnabled || config.sandbox !== true) {
    return null;
  }

  return {
    accessToken: config.accessToken,
    accountScope: getMercadoPagoSavedCardScope({
      accessToken: config.accessToken,
      splitEnabled: config.splitEnabled,
      externalAccountId: config.externalAccountId,
    }),
  };
}

const SaveCardSchema = z.object({
  token: z.string().trim().min(1).max(8192),
});

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Debés iniciar sesión para consultar tus tarjetas.' },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const context = await getPaymentContext();
    if (!context) {
      return NextResponse.json(
        { error: 'El guardado de tarjetas está disponible en el entorno sandbox configurado.' },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    const customer = await prisma.paymentCustomer.findUnique({
      where: {
        userId_provider_accountScope: {
          userId: user.id,
          provider: 'MERCADOPAGO',
          accountScope: context.accountScope,
        },
      },
      include: { cards: { orderBy: { createdAt: 'desc' } } },
    });

    if (!customer) {
      return NextResponse.json({ cards: [] }, { headers: NO_STORE_HEADERS });
    }

    // Keep the local display cache synchronized if a customer removed a card
    // directly in Mercado Pago. If the provider is temporarily unavailable,
    // retain the last known masked details, but never expose card secrets.
    const remoteCards = await mercadoPagoApi<MercadoPagoCard[]>(
      context.accessToken,
      `/v1/customers/${encodeURIComponent(customer.externalCustomerId)}/cards`,
      'GET',
    );

    if (remoteCards.status >= 200 && remoteCards.status < 300 && Array.isArray(remoteCards.data)) {
      const validCards = remoteCards.data.filter(
        (card): card is MercadoPagoCard & { id: string | number } =>
          card.id !== undefined && card.id !== null,
      );
      const remoteIds = validCards.map((card) => String(card.id));

      await prisma.savedPaymentMethod.deleteMany({
        where: {
          paymentCustomerId: customer.id,
          ...(remoteIds.length > 0 ? { externalCardId: { notIn: remoteIds } } : {}),
        },
      });

      for (const card of validCards) {
        const paymentMethodId = card.payment_method?.id;
        if (!paymentMethodId) continue;
        const externalCardId = String(card.id);
        const updateData = {
          paymentMethodId,
          paymentType: card.payment_method?.payment_type_id ?? null,
          paymentMethodName: card.payment_method?.name ?? paymentMethodId,
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
              externalCardId,
            },
          },
          create: { paymentCustomerId: customer.id, externalCardId, ...updateData },
          update: updateData,
        });
      }
    }

    const cards = await prisma.savedPaymentMethod.findMany({
      where: { paymentCustomerId: customer.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ cards: cards.map(toPublicCard) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('No se pudieron consultar las tarjetas guardadas de Mercado Pago.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { error: 'No se pudieron cargar las tarjetas guardadas.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Debés iniciar sesión para guardar una tarjeta.' },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const limit = checkRateLimit(`save-card:${hashRateLimitIdentity(user.id)}`, {
      limit: 5,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Hiciste demasiados intentos para guardar tarjetas. Esperá un minuto.' },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            'Retry-After': String(limit.retryAfterSeconds),
          },
        },
      );
    }

    const parsed = SaveCardSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'El token de tarjeta no es válido.' },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const context = await getPaymentContext();
    if (!context) {
      return NextResponse.json(
        { error: 'El guardado de tarjetas solo está habilitado en sandbox por ahora.' },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    let customer = await prisma.paymentCustomer.findUnique({
      where: {
        userId_provider_accountScope: {
          userId: user.id,
          provider: 'MERCADOPAGO',
          accountScope: context.accountScope,
        },
      },
    });

    if (!customer) {
      const email = getMercadoPagoSandboxCustomerEmail(user.id);
      const customerResponse = await mercadoPagoApi<MercadoPagoCustomer | MercadoPagoApiError>(
        context.accessToken,
        '/v1/customers',
        'POST',
        {
          email,
          ...(user.firstName ? { first_name: user.firstName } : {}),
          ...(user.lastName ? { last_name: user.lastName } : {}),
        },
      );

      if (
        customerResponse.status < 200 ||
        customerResponse.status >= 300 ||
        !('id' in customerResponse.data) ||
        !customerResponse.data.id
      ) {
        const providerError = safeProviderError(customerResponse.data);
        console.error('Mercado Pago no pudo crear el cliente para tarjetas guardadas.', {
          status: customerResponse.status,
          requestId: customerResponse.requestId,
          code: providerError.code,
        });
        return NextResponse.json(
          { error: 'Mercado Pago no pudo preparar el guardado de la tarjeta.' },
          { status: 502, headers: NO_STORE_HEADERS },
        );
      }

      try {
        customer = await prisma.paymentCustomer.create({
          data: {
            userId: user.id,
            provider: 'MERCADOPAGO',
            accountScope: context.accountScope,
            externalCustomerId: customerResponse.data.id,
          },
        });
      } catch (error) {
        // A concurrent request may have created this account-scoped customer.
        customer = await prisma.paymentCustomer.findUnique({
          where: {
            userId_provider_accountScope: {
              userId: user.id,
              provider: 'MERCADOPAGO',
              accountScope: context.accountScope,
            },
          },
        });
        if (!customer) throw error;
      }
    }

    const cardResponse = await mercadoPagoApi<MercadoPagoCard | MercadoPagoApiError>(
      context.accessToken,
      `/v1/customers/${encodeURIComponent(customer.externalCustomerId)}/cards`,
      'POST',
      { token: parsed.data.token },
    );

    if (
      cardResponse.status < 200 ||
      cardResponse.status >= 300 ||
      !('id' in cardResponse.data) ||
      cardResponse.data.id === undefined ||
      cardResponse.data.id === null ||
      !cardResponse.data.payment_method?.id
    ) {
      const providerError = safeProviderError(cardResponse.data);
      console.error('Mercado Pago no pudo asociar la tarjeta tokenizada.', {
        status: cardResponse.status,
        requestId: cardResponse.requestId,
        code: providerError.code,
      });
      return NextResponse.json(
        {
          error: 'Mercado Pago no pudo guardar esta tarjeta. Revisá los datos e intentá otra vez.',
        },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    const savedCard = cardResponse.data as MercadoPagoCard & { id: string | number };
    const externalCardId = String(savedCard.id);
    const updateData = {
      paymentMethodId: savedCard.payment_method!.id!,
      paymentType: savedCard.payment_method?.payment_type_id ?? null,
      paymentMethodName: savedCard.payment_method?.name ?? savedCard.payment_method!.id!,
      lastFourDigits: /^\d{4}$/.test(savedCard.last_four_digits ?? '')
        ? savedCard.last_four_digits!
        : null,
      expirationMonth: Number.isInteger(savedCard.expiration_month)
        ? savedCard.expiration_month!
        : null,
      expirationYear: Number.isInteger(savedCard.expiration_year)
        ? savedCard.expiration_year!
        : null,
    };

    const savedMethod = await prisma.savedPaymentMethod.upsert({
      where: {
        paymentCustomerId_externalCardId: {
          paymentCustomerId: customer.id,
          externalCardId,
        },
      },
      create: {
        paymentCustomerId: customer.id,
        externalCardId,
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json(
      { card: toPublicCard(savedMethod) },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('No se pudo guardar la tarjeta de Mercado Pago.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { error: 'No se pudo guardar la tarjeta. Intentá nuevamente.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Debés iniciar sesión para eliminar una tarjeta.' },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id || id.length > 191) {
      return NextResponse.json(
        { error: 'La tarjeta seleccionada no es válida.' },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const context = await getPaymentContext();
    if (!context) {
      return NextResponse.json(
        { error: 'La gestión de tarjetas solo está habilitada en sandbox por ahora.' },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    const card = await prisma.savedPaymentMethod.findFirst({
      where: {
        id,
        paymentCustomer: {
          is: {
            userId: user.id,
            provider: 'MERCADOPAGO',
            accountScope: context.accountScope,
          },
        },
      },
      include: { paymentCustomer: true },
    });

    if (!card) {
      return NextResponse.json(
        { error: 'No se encontró esa tarjeta guardada.' },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const response = await mercadoPagoApi<unknown>(
      context.accessToken,
      `/v1/customers/${encodeURIComponent(card.paymentCustomer.externalCustomerId)}/cards/${encodeURIComponent(card.externalCardId)}`,
      'DELETE',
    );

    if (response.status < 200 || response.status >= 300) {
      return NextResponse.json(
        { error: 'Mercado Pago no pudo eliminar la tarjeta. Intentá otra vez.' },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    await prisma.savedPaymentMethod.delete({ where: { id: card.id } });
    return NextResponse.json({ deleted: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('No se pudo eliminar la tarjeta guardada.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { error: 'No se pudo eliminar la tarjeta guardada.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
