import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { accountSchema } from '@/lib/account/accountSchema';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

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

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select,
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = accountSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...data,
        dni: data.dni || null,
        shippingApartment: data.shippingApartment || null,
        name: [data.firstName, data.lastName].join(' ').trim(),
      },
      select,
    });

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Revisá los datos ingresados.' }, { status: 400 });
    }

    console.error('Error actualizando la cuenta:', error);

    return NextResponse.json({ error: 'No se pudieron guardar los datos.' }, { status: 500 });
  }
}
