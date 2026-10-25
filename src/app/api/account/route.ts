import { NextResponse } from 'next/server';
import { z } from 'zod';
import { accountSchema } from '@/lib/account/accountSchema';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

const select = {
  firstName: true,
  lastName: true,
  phone: true,
  dni: true,
  shippingStreet: true,
  shippingNumber: true,
  shippingApartment: true,
  shippingCity: true,
  shippingProvince: true,
  shippingPostalCode: true,
  shippingCountry: true,
};

function privateNoStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(request: Request) {
  const authenticatedUser = await getAuthenticatedUser(request);

  if (!authenticatedUser) {
    return privateNoStoreJson({ error: 'No autenticado.' }, { status: 401 });
  }

  const rateLimit = checkRateLimit('account-read:' + hashRateLimitIdentity(authenticatedUser.id), {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return privateNoStoreJson(
      { error: 'Demasiadas solicitudes. Volvé a intentar en un minuto.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: authenticatedUser.id },
    select,
  });

  if (!user) {
    return privateNoStoreJson({ error: 'Usuario no encontrado.' }, { status: 404 });
  }

  return privateNoStoreJson(user);
}

export async function PUT(req: Request) {
  const authenticatedUser = await getAuthenticatedUser(req);

  if (!authenticatedUser) {
    return privateNoStoreJson({ error: 'No autenticado.' }, { status: 401 });
  }

  const rateLimit = checkRateLimit('account-write:' + hashRateLimitIdentity(authenticatedUser.id), {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return privateNoStoreJson(
      { error: 'Demasiadas actualizaciones. Volvé a intentar en un minuto.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const body = await req.json();
    const data = accountSchema.parse(body);

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: authenticatedUser.id },
        data: {
          ...data,
          dni: data.dni || null,
          shippingApartment: data.shippingApartment || null,
          name: [data.firstName, data.lastName].join(' ').trim(),
        },
        select,
      });

      // Keep the legacy profile fields in sync with the default saved address.
      // Older checkout paths and the mobile client still read those profile fields.
      const addressData = {
        shippingStreet: data.shippingStreet,
        shippingNumber: data.shippingNumber,
        shippingApartment: data.shippingApartment || null,
        shippingCity: data.shippingCity,
        shippingProvince: data.shippingProvince,
        shippingPostalCode: data.shippingPostalCode,
        shippingCountry: data.shippingCountry,
      };
      const defaultAddress = await tx.deliveryAddress.findFirst({
        where: { userId: authenticatedUser.id, isDefault: true },
        select: { id: true },
      });

      if (defaultAddress) {
        await tx.deliveryAddress.update({
          where: { id: defaultAddress.id },
          data: addressData,
        });
      } else {
        await tx.deliveryAddress.updateMany({
          where: { userId: authenticatedUser.id, isDefault: true },
          data: { isDefault: false },
        });
        await tx.deliveryAddress.create({
          data: {
            ...addressData,
            userId: authenticatedUser.id,
            label: 'Casa',
            isDefault: true,
          },
        });
      }

      return updatedUser;
    });

    return privateNoStoreJson(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return privateNoStoreJson({ error: 'Revisá los datos ingresados.' }, { status: 400 });
    }

    console.error(
      'Error actualizando la cuenta:',
      error instanceof Error ? error.name : 'UnknownError',
    );

    return privateNoStoreJson({ error: 'No se pudieron guardar los datos.' }, { status: 500 });
  }
}
