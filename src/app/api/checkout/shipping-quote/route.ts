import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isCheckoutProfileComplete } from '@/lib/account/checkout-profile';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';
import { createCheckoutQuoteToken } from '@/lib/shipping/checkout-quote-token';
import { quoteCheckoutShipping } from '@/lib/shipping/order-shipping';

const IdSchema = z.union([z.string().trim().min(1).max(191), z.number().int().positive().safe()]);

const QuoteRequestSchema = z.object({
  items: z
    .array(
      z.object({
        id: IdSchema.optional(),
        productId: IdSchema.optional(),
        articleId: IdSchema.optional(),
        variantId: z.string().trim().min(1).max(191).optional(),
        colorName: z.string().trim().max(100).optional(),
        title: z.string().trim().max(200).optional().default(''),
        quantity: z.coerce.number().int().min(1).max(99),
        size: z.string().trim().min(1).max(32),
      }),
    )
    .min(1)
    .max(100),
  paymentCurrency: z.enum(['ARS', 'USD']),
  deliveryAddressId: z.string().trim().min(1).max(191).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Iniciá sesión para cotizar el envío.' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`shipping-quote:${hashRateLimitIdentity(user.id)}`, {
      limit: 12,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Hiciste demasiadas cotizaciones. Esperá un minuto y volvé a intentar.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const parsed = QuoteRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Los datos del carrito o la dirección son inválidos.' },
        { status: 400 },
      );
    }

    const savedAddress = await prisma.deliveryAddress.findFirst({
      where: {
        userId: user.id,
        ...(parsed.data.deliveryAddressId
          ? { id: parsed.data.deliveryAddressId }
          : { isDefault: true }),
      },
    });
    if (!savedAddress) {
      return NextResponse.json(
        {
          code: 'DELIVERY_ADDRESS_REQUIRED',
          error: 'Guardá una dirección de entrega en Mi cuenta antes de cotizar el envío.',
          accountUrl: '/account',
        },
        { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    const checkoutUser = {
      ...user,
      deliveryAddressId: savedAddress.id,
      shippingStreet: savedAddress.shippingStreet,
      shippingNumber: savedAddress.shippingNumber,
      shippingApartment: savedAddress.shippingApartment,
      shippingCity: savedAddress.shippingCity,
      shippingProvince: savedAddress.shippingProvince,
      shippingPostalCode: savedAddress.shippingPostalCode,
      shippingCountry: savedAddress.shippingCountry,
    };

    if (!isCheckoutProfileComplete(checkoutUser)) {
      return NextResponse.json(
        {
          code: 'PROFILE_INCOMPLETE',
          error:
            'Completá y guardá tus datos personales y dirección de entrega en Mi cuenta antes de cotizar el envío.',
          accountUrl: '/account',
        },
        { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    const result = await quoteCheckoutShipping(
      checkoutUser,
      parsed.data.items,
      parsed.data.paymentCurrency,
    );
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json(
      {
        quotes: result.quotes.map((quote) => ({
          ...quote,
          quoteToken: createCheckoutQuoteToken(checkoutUser, parsed.data.items, quote),
        })),
        provider: result.provider,
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('Checkout shipping quote failed.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { error: 'No se pudo cotizar el envío. Revisá la dirección y la configuración logística.' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }
}
