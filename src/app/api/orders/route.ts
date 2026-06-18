import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface OrderItemInput {
  id?: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
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
      return NextResponse.json({ message: "Datos incompletos" }, { status: 400 });
    }

    const nuevaOrden = await prisma.order.create({
      data: {
        id: paymentId,
        userId: userId,
        total: Number(total),
        status: "PAID",
        items: {
          create: items.map((item: OrderItemInput) => ({
            productId: item.id || "manual-id",
            title: item.title,
            price: Number(item.price),
            quantity: Number(item.quantity),
            image: item.image || "",
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json(nuevaOrden, { status: 201 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error al guardar la orden en Aiven:", error);
    return NextResponse.json({ message: "Internal Server Error", error: errMsg }, { status: 500 });
  }
}

// 🔒 REVISADO Y SEGUIDO POR SEGURIDAD CON NEXTAUTH
export async function GET() {
  try {
    // Obtenemos la sesión activa de forma segura en el servidor
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Iniciá sesión para ver tu historial" }, { status: 401 });
    }

    // Buscamos las órdenes del usuario logueado en Aiven
    const ordenes = await prisma.order.findMany({
      where: { userId: session.user.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(ordenes);
  } catch (error: unknown) {
    console.error("❌ Error al traer historial desde Aiven:", error);
    return NextResponse.json({ message: "Error al traer el historial" }, { status: 500 });
  }
}