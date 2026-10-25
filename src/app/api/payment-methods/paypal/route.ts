import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import {
  getLocalPayPalSavedCards,
  getPayPalSavedCardScope,
  getPayPalSandboxAccessToken,
  getPayPalVaultHeaders,
  persistPayPalVaultCard,
} from '@/lib/payments/paypal-saved-cards';
import { paypalPaymentConfig } from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };
const DeleteCardSchema = z
  .object({ savedPaymentMethodId: z.string().trim().min(1).max(191) })
  .strict();
const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';

type PayPalVaultToken = {
  id?: string;
  customer?: { id?: string };
  payment_source?: {
    card?: {
      brand?: string;
      last_digits?: string;
      expiry?: string;
    };
  };
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS });
}

async function getPayPalContext() {
  const config = await paypalPaymentConfig();
  if (
    !config.sandbox ||
    !config.splitEnabled ||
    !config.clientId ||
    !config.clientSecret ||
    !config.sellerMerchantId
  ) {
    return null;
  }
  return {
    config,
    accountScope: getPayPalSavedCardScope(config.sellerMerchantId),
  };
}

function publicCards(cards: Awaited<ReturnType<typeof getLocalPayPalSavedCards>>['cards']) {
  return cards;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return errorResponse('Debés iniciar sesión para consultar tus tarjetas.', 401);

    const rateLimit = checkRateLimit(`paypal-saved-cards-read:${hashRateLimitIdentity(user.id)}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed)
      return errorResponse('Demasiadas consultas. Volvé a intentar en un minuto.', 429);

    const context = await getPayPalContext();
    if (!context) {
      return NextResponse.json({ cards: [] }, { headers: NO_STORE_HEADERS });
    }

    const { customer, cards: cachedCards } = await getLocalPayPalSavedCards(
      user.id,
      context.accountScope,
    );
    if (!customer) return NextResponse.json({ cards: [] }, { headers: NO_STORE_HEADERS });

    try {
      const accessToken = await getPayPalSandboxAccessToken(context.config);
      const listResponse = await fetch(
        `${PAYPAL_SANDBOX_API}/v3/vault/payment-tokens?customer_id=${encodeURIComponent(customer.externalCustomerId)}`,
        { headers: getPayPalVaultHeaders(context.config, accessToken), cache: 'no-store' },
      );
      const data = (await listResponse.json().catch(() => ({}))) as {
        payment_tokens?: PayPalVaultToken[];
      };

      if (!listResponse.ok || !Array.isArray(data.payment_tokens)) {
        console.error('[paypal-saved-cards] provider list failed:', {
          status: listResponse.status,
        });
        return NextResponse.json(
          { cards: publicCards(cachedCards) },
          { headers: NO_STORE_HEADERS },
        );
      }

      const validTokens = data.payment_tokens.filter(
        (token): token is PayPalVaultToken & { id: string } => {
          if (typeof token.id !== 'string' || !token.id.trim()) return false;
          return !token.customer?.id || token.customer.id === customer.externalCustomerId;
        },
      );
      const remoteIds = validTokens.map((token) => token.id);

      // PayPal can finish vaulting asynchronously after the order capture.
      // An empty list at that point isn't sufficient evidence to purge existing
      // cards; explicit deletion is handled by this route's DELETE operation.
      if (remoteIds.length > 0) {
        await prisma.savedPaymentMethod.deleteMany({
          where: {
            paymentCustomerId: customer.id,
            externalCardId: { notIn: remoteIds },
          },
        });
      }

      for (const token of validTokens) {
        const card = token.payment_source?.card;
        if (!card) continue;
        await persistPayPalVaultCard({
          userId: user.id,
          sellerMerchantId: context.config.sellerMerchantId!,
          card: {
            id: token.id,
            customerId: token.customer?.id || customer.externalCustomerId,
            brand: card.brand,
            lastDigits: card.last_digits,
            expiry: card.expiry,
          },
        });
      }

      const refreshed = await getLocalPayPalSavedCards(user.id, context.accountScope);
      return NextResponse.json(
        { cards: publicCards(refreshed.cards) },
        { headers: NO_STORE_HEADERS },
      );
    } catch (syncError) {
      // The provider may temporarily be unavailable; allow a previously verified
      // masked card to remain visible. The checkout route revalidates its vault ID.
      console.error(
        '[paypal-saved-cards] provider sync unavailable:',
        syncError instanceof Error ? syncError.name : 'UnknownError',
      );
      return NextResponse.json({ cards: publicCards(cachedCards) }, { headers: NO_STORE_HEADERS });
    }
  } catch (error) {
    console.error(
      '[paypal-saved-cards] list failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return errorResponse('No se pudieron consultar tus tarjetas guardadas.', 502);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return errorResponse('Debés iniciar sesión para quitar una tarjeta.', 401);

    const rateLimit = checkRateLimit(
      `paypal-saved-cards-delete:${hashRateLimitIdentity(user.id)}`,
      {
        limit: 10,
        windowMs: 60_000,
      },
    );
    if (!rateLimit.allowed)
      return errorResponse('Demasiados intentos. Volvé a intentar en un minuto.', 429);

    const parsed = DeleteCardSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse('La tarjeta seleccionada no es válida.', 400);

    const context = await getPayPalContext();
    if (!context)
      return errorResponse('El guardado de tarjetas de PayPal no está habilitado en sandbox.', 503);

    const card = await prisma.savedPaymentMethod.findFirst({
      where: {
        id: parsed.data.savedPaymentMethodId,
        paymentCustomer: {
          userId: user.id,
          provider: 'PAYPAL',
          accountScope: context.accountScope,
        },
      },
      include: { paymentCustomer: true },
    });
    if (!card) return errorResponse('La tarjeta no pertenece a tu cuenta.', 404);

    const accessToken = await getPayPalSandboxAccessToken(context.config);
    const response = await fetch(
      `${PAYPAL_SANDBOX_API}/v3/vault/payment-tokens/${encodeURIComponent(card.externalCardId)}`,
      {
        method: 'DELETE',
        headers: getPayPalVaultHeaders(context.config, accessToken),
        cache: 'no-store',
      },
    );
    if (!response.ok && response.status !== 404) {
      console.error('[paypal-saved-cards] provider delete failed:', { status: response.status });
      return errorResponse('PayPal no pudo eliminar la tarjeta guardada. Intentá de nuevo.', 502);
    }

    await prisma.savedPaymentMethod.delete({ where: { id: card.id } });
    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error(
      '[paypal-saved-cards] delete failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return errorResponse('No se pudo quitar la tarjeta guardada.', 502);
  }
}
