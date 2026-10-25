import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deliveryAddressUpdateSchema } from '@/lib/account/delivery-address-schema';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

const selectAddress = {
  id: true,
  label: true,
  shippingStreet: true,
  shippingNumber: true,
  shippingApartment: true,
  shippingCity: true,
  shippingProvince: true,
  shippingPostalCode: true,
  shippingCountry: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
};

function privateNoStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return NextResponse.json(body, { ...init, headers });
}

function addressFields(address: {
  shippingStreet: string;
  shippingNumber: string;
  shippingApartment?: string | null;
  shippingCity: string;
  shippingProvince: string;
  shippingPostalCode: string;
  shippingCountry: string;
}) {
  return {
    shippingStreet: address.shippingStreet,
    shippingNumber: address.shippingNumber,
    shippingApartment: address.shippingApartment || null,
    shippingCity: address.shippingCity,
    shippingProvince: address.shippingProvince,
    shippingPostalCode: address.shippingPostalCode,
    shippingCountry: address.shippingCountry,
  };
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return privateNoStoreJson({ error: 'No autenticado.' }, { status: 401 });

  const limit = checkRateLimit(`account-address-read:${hashRateLimitIdentity(user.id)}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return privateNoStoreJson(
      { error: 'Demasiadas solicitudes. Volvé a intentar en un minuto.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const addresses = await prisma.deliveryAddress.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: selectAddress,
  });

  return privateNoStoreJson({ addresses });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return privateNoStoreJson({ error: 'No autenticado.' }, { status: 401 });

  const limit = checkRateLimit(`account-address-write:${hashRateLimitIdentity(user.id)}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return privateNoStoreJson(
      { error: 'Demasiados cambios de dirección. Volvé a intentar en un minuto.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const parsed = deliveryAddressUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return privateNoStoreJson(
        { error: 'Revisá los datos de la dirección ingresada.' },
        { status: 400 },
      );
    }

    const { isDefault: requestedDefault, ...input } = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.deliveryAddress.count({ where: { userId: user.id } });
      const makeDefault = requestedDefault === true || existingCount === 0;

      if (makeDefault) {
        await tx.deliveryAddress.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
      }

      const address = await tx.deliveryAddress.create({
        data: {
          ...input,
          ...addressFields(input),
          userId: user.id,
          isDefault: makeDefault,
        },
        select: selectAddress,
      });

      if (makeDefault) {
        await tx.user.update({
          where: { id: user.id },
          data: addressFields(input),
        });
      }

      return address;
    });

    return privateNoStoreJson({ address: result }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return privateNoStoreJson(
        { error: 'Revisá los datos de la dirección ingresada.' },
        { status: 400 },
      );
    }
    console.error(
      'Error creando dirección de entrega:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return privateNoStoreJson({ error: 'No se pudo guardar la dirección.' }, { status: 500 });
  }
}
