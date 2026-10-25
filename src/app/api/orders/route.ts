import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { prisma } from '@/lib/prisma';

function privateNoStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return NextResponse.json(body, { ...init, headers });
}

export async function POST() {
  return privateNoStoreJson(
    {
      message:
        'Este endpoint legado está deshabilitado. La orden debe originarse en checkout y confirmarse contra el proveedor de pago.',
    },
    { status: 410 },
  );
}

export async function GET(request: Request) {
  try {
    // 1. Intentar obtener datos desde la sesión Web
    //    (cookies NextAuth)
    const authenticatedUser = await getAuthenticatedUser(request);
    if (!authenticatedUser) {
      return privateNoStoreJson(
        { message: 'Iniciá sesión para ver tu historial' },
        { status: 401 },
      );
    }

    const ordenes = await prisma.order.findMany({
      where: { userId: authenticatedUser.id },
      include: {
        items: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            shippingStreet: true,
            shippingNumber: true,
            shippingApartment: true,
            shippingCity: true,
            shippingProvince: true,
            shippingPostalCode: true,
            shippingCountry: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const ordenesPagadas = ordenes
      .filter((orden: { status: string }) =>
        ['PAID', 'REFUND_PENDING', 'REFUNDED'].includes(orden.status),
      )
      .map((orden) => ({
        ...orden,
        deliveryFirstName: orden.deliveryFirstName ?? orden.user.firstName,
        deliveryLastName: orden.deliveryLastName ?? orden.user.lastName,
        deliveryPhone: orden.deliveryPhone ?? orden.user.phone,
        deliveryStreet: orden.deliveryStreet ?? orden.user.shippingStreet,
        deliveryNumber: orden.deliveryNumber ?? orden.user.shippingNumber,
        deliveryApartment: orden.deliveryApartment ?? orden.user.shippingApartment,
        deliveryCity: orden.deliveryCity ?? orden.user.shippingCity,
        deliveryProvince: orden.deliveryProvince ?? orden.user.shippingProvince,
        deliveryPostalCode: orden.deliveryPostalCode ?? orden.user.shippingPostalCode,
        deliveryCountry: orden.deliveryCountry ?? orden.user.shippingCountry,
        canCancel:
          orden.status === 'PAID' &&
          orden.fulfillmentStatus === 'PENDING' &&
          !orden.shippingExternalId,
        paymentExternalId: undefined,
        refundExternalId: undefined,
        shippingExternalId: undefined,
        shippingLabelUrl: undefined,
        shippingError: undefined,
        user: undefined,
      }));

    return privateNoStoreJson(ordenesPagadas);
  } catch (error: unknown) {
    console.error('❌ Error al traer historial desde Aiven:', error);

    return privateNoStoreJson(
      {
        message: 'Error al traer el historial',
      },
      {
        status: 500,
      },
    );
  }
}
