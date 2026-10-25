import { NextResponse } from 'next/server';
import { deliveryAddressUpdateSchema } from '@/lib/account/delivery-address-schema';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

type RouteContext = { params: Promise<{ addressId: string }> };

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

export async function PATCH(request: Request, context: RouteContext) {
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

  const { addressId } = await context.params;
  const parsed = deliveryAddressUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return privateNoStoreJson(
      { error: 'Revisá los datos de la dirección ingresada.' },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.deliveryAddress.findFirst({
      where: { id: addressId, userId: user.id },
      select: { id: true, isDefault: true },
    });
    if (!existing) {
      return privateNoStoreJson({ error: 'Dirección no encontrada.' }, { status: 404 });
    }

    const { isDefault: requestedDefault, ...input } = parsed.data;
    const makeDefault = existing.isDefault || requestedDefault === true;
    const updated = await prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.deliveryAddress.updateMany({
          where: { userId: user.id, isDefault: true, id: { not: addressId } },
          data: { isDefault: false },
        });
      }

      const address = await tx.deliveryAddress.update({
        where: { id: addressId },
        data: {
          ...input,
          ...addressFields(input),
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

    return privateNoStoreJson({ address: updated });
  } catch (error) {
    console.error(
      'Error actualizando dirección de entrega:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return privateNoStoreJson({ error: 'No se pudo actualizar la dirección.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
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

  const { addressId } = await context.params;
  const existing = await prisma.deliveryAddress.findFirst({
    where: { id: addressId, userId: user.id },
    select: { id: true, isDefault: true },
  });
  if (!existing) {
    return privateNoStoreJson({ error: 'Dirección no encontrada.' }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.deliveryAddress.deleteMany({
        where: { id: addressId, userId: user.id },
      });

      if (!existing.isDefault) return;

      const replacement = await tx.deliveryAddress.findFirst({
        where: { userId: user.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          shippingStreet: true,
          shippingNumber: true,
          shippingApartment: true,
          shippingCity: true,
          shippingProvince: true,
          shippingPostalCode: true,
          shippingCountry: true,
        },
      });

      if (replacement) {
        await tx.deliveryAddress.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
        await tx.deliveryAddress.update({
          where: { id: replacement.id },
          data: { isDefault: true },
        });
        await tx.user.update({
          where: { id: user.id },
          data: addressFields(replacement),
        });
      } else {
        await tx.user.update({
          where: { id: user.id },
          data: {
            shippingStreet: null,
            shippingNumber: null,
            shippingApartment: null,
            shippingCity: null,
            shippingProvince: null,
            shippingPostalCode: null,
            shippingCountry: 'Argentina',
          },
        });
      }
    });

    return privateNoStoreJson({ success: true });
  } catch (error) {
    console.error(
      'Error eliminando dirección de entrega:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return privateNoStoreJson({ error: 'No se pudo eliminar la dirección.' }, { status: 500 });
  }
}
