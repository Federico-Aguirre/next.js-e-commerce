import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

interface OrderItemInput {
  id?: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
  size?: string;
  colorName?: string;
}

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
      return NextResponse.json({ message: 'Datos incompletos' }, { status: 400 });
    }

    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + 7);

    const nuevaOrden = await prisma.order.create({
      data: {
        id: paymentId,
        userId: userId,
        total: Number(total),
        status: 'PAID',
        expiresAt: fechaExpiracion,
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

    return NextResponse.json(nuevaOrden, { status: 201 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error al guardar la orden en Aiven:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: errMsg }, { status: 500 });
  }
}

// 🔒 SOPORTE HÍBRIDO: WEB (COOKIES) Y MOBILE (HEADERS)
export async function GET(request: Request) {
  try {
    // 1. Intentar obtener datos desde la sesión Web (cookies NextAuth)
    const session = await getServerSession(authOptions);
    let userId = session?.user?.id;
    let userEmail = session?.user?.email;

    // 2. Si viene de la App Móvil, leer los encabezados HTTP
    if (!userId && !userEmail) {
      userId = request.headers.get('x-user-id') || undefined;
      userEmail = request.headers.get('x-user-email') || undefined;
    }

    // 3. Si no hay ni sesión web ni headers móviles, rechazar
    if (!userId && !userEmail) {
      return NextResponse.json(
        { message: 'Iniciá sesión para ver tu historial' },
        { status: 401 }
      );
    }

    // 4. Buscar órdenes asociadas por ID o por Email como respaldo
    const ordenes = await prisma.order.findMany({
      where: {
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(userEmail ? [{ user: { email: userEmail } }] : []),
        ],
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(ordenes);
  } catch (error: unknown) {
    console.error('❌ Error al traer historial desde Aiven:', error);
    return NextResponse.json({ message: 'Error al traer el historial' }, { status: 500 });
  }
}