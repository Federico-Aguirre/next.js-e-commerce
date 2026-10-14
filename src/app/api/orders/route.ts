import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { sendLowStockAlerts, sendPaidOrderAlert } from '@/lib/order-alerts';
import { prisma } from '@/lib/prisma';

type OrderItemInput = {
  id?: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
  size?: string;
  colorName?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { userId, paymentId, total, items } = body as {
      userId: string;
      paymentId: string;
      total: number;
      items: OrderItemInput[];
    };

    if (!userId || !items || items.length === 0) {
      return NextResponse.json(
        {
          message: 'Datos incompletos',
        },
        {
          status: 400,
        },
      );
    }

    const orderUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!orderUser) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
    }

    const fechaExpiracion = new Date();

    fechaExpiracion.setDate(fechaExpiracion.getDate() + 7);

    const nuevaOrden = await prisma.order.create({
      data: {
        id: paymentId,
        userId,
        total: Number(total),
        status: 'PAID',
        paymentProvider: 'MERCADOPAGO',
        paymentExternalId: paymentId,
        expiresAt: fechaExpiracion,
        deliveryFirstName: orderUser.firstName,
        deliveryLastName: orderUser.lastName,
        deliveryPhone: orderUser.phone,
        deliveryDni: orderUser.dni,
        deliveryStreet: orderUser.shippingStreet,
        deliveryNumber: orderUser.shippingNumber,
        deliveryApartment: orderUser.shippingApartment,
        deliveryCity: orderUser.shippingCity,
        deliveryProvince: orderUser.shippingProvince,
        deliveryPostalCode: orderUser.shippingPostalCode,
        deliveryCountry: orderUser.shippingCountry,

        items: {
          create: items.map((item: OrderItemInput) => ({
            productId: item.id || 'manual-id',

            title: item.title,
            price: Number(item.price),
            quantity: Number(item.quantity),
            image: item.image || '',
            size: item.size || 'M',
            colorName: item.colorName || 'Único',
          })),
        },
      } as any,

      include: {
        items: true,
      },
    });

    void sendPaidOrderAlert(nuevaOrden.id);
    await sendLowStockAlerts();

    return NextResponse.json(nuevaOrden, {
      status: 201,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';

    console.error('❌ Error al guardar la orden en Aiven:', error);

    return NextResponse.json(
      {
        message: 'Internal Server Error',
        error: errMsg,
      },
      {
        status: 500,
      },
    );
  }
}

// 🔒 SOPORTE HÍBRIDO: WEB (COOKIES) Y MOBILE (HEADERS)
export async function GET(request: Request) {
  try {
    // 1. Intentar obtener datos desde la sesión Web
    //    (cookies NextAuth)
    const session = await getServerSession(authOptions);

    let userId = session?.user?.id;

    let userEmail = session?.user?.email;

    // 2. Si viene de la App Móvil,
    //    leer los encabezados HTTP
    if (!userId && !userEmail) {
      userId = request.headers.get('x-user-id') || undefined;

      userEmail = request.headers.get('x-user-email') || undefined;
    }

    // 3. Si no hay ni sesión web ni headers móviles
    if (!userId && !userEmail) {
      return NextResponse.json(
        {
          message: 'Iniciá sesión para ver tu historial',
        },
        {
          status: 401,
        },
      );
    }

    // 4. Buscar órdenes asociadas por ID
    //    o por Email como respaldo
    const ordenes = await prisma.order.findMany({
      where: {
        OR: [
          ...(userId ? [{ userId }] : []),

          ...(userEmail
            ? [
                {
                  user: {
                    email: userEmail,
                  },
                },
              ]
            : []),
        ],
      },

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

      orderBy: {
        createdAt: 'desc',
      },
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

    return NextResponse.json(ordenesPagadas);
  } catch (error: unknown) {
    console.error('❌ Error al traer historial desde Aiven:', error);

    return NextResponse.json(
      {
        message: 'Error al traer el historial',
      },
      {
        status: 500,
      },
    );
  }
}
