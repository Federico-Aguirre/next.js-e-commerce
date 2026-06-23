import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Preference } from "mercadopago";

const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const dynamic = 'force-dynamic';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

interface CartItem {
  id?: string;
  articleId?: string | number;
  productId?: string | number;
  title: string;
  price: number;
  quantity: number;
  image: string;
  size: string;
}

// =========================================================================
// 🚀 CREAR ORDEN Y RESERVAR STOCK (POST)
// =========================================================================
export async function POST(req: Request) {
  try {
    console.log("=== 🚀 ¡EJECUTANDO CHECKOUT CON RESERVA DE STOCK (5 MIN) CORREGIDO! ===");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { items, paymentMethod } = await req.json() as { items: CartItem[], paymentMethod: 'mercadopago' | 'stripe' };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const now = new Date();
    const expirationTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 Minutos

    // 🛡️ PASO 0: LAZY CLEANING (Por si acaso quedan otras colgadas de otros usuarios)
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now }
      },
      include: { items: true }
    });

    if (expiredOrders.length > 0) {
      console.log(`🧹 Encontradas ${expiredOrders.length} órdenes expiradas. Devolviendo stock...`);
      await prisma.$transaction(async (tx: any) => {
        for (const oldOrder of expiredOrders) {
          for (const oldItem of oldOrder.items) {
            const sku = await tx.productSku.findFirst({
              where: { articleId: Number(oldItem.productId), size: oldItem.size }
            });
            if (sku) {
              await tx.productSku.update({
                where: { id: sku.id },
                data: { stock: sku.stock + oldItem.quantity }
              });
            }
          }
          await tx.order.update({
            where: { id: oldOrder.id },
            data: { status: "EXPIRED" }
          });
        }
      });
    }

    // 🔒 TRANSACCIÓN PRINCIPAL
    const order = await prisma.$transaction(async (tx: any) => {
      for (const item of items) {
        const rawId = String(item.articleId || item.productId || item.id || "");
        if (!rawId) throw new Error(`Estructura de producto inválida.`);

        const numericArticleId = Number(rawId.replace(/\D/g, ""));
        const sku = await tx.productSku.findFirst({
          where: { articleId: numericArticleId, size: item.size }
        });

        if (!sku || sku.stock < item.quantity) {
          throw new Error(`Lo sentimos, no hay stock suficiente de "${item.title}" en talle ${item.size.toUpperCase()}.`);
        }

        await tx.productSku.update({
          where: { id: sku.id },
          data: { stock: sku.stock - item.quantity }
        });
      }

      return await tx.order.create({
        data: {
          userId: session.user.id,
          total,
          status: "PENDING",
          expiresAt: expirationTime,
          items: {
            create: items.map((item) => {
              const rawId = String(item.articleId || item.productId || item.id || "");
              return {
                productId: String(rawId.replace(/\D/g, "")),
                title: item.title,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
                size: item.size
              };
            }),
          },
        },
      });
    });

    // 💳 PASARELAS DE PAGO
    if (paymentMethod === "mercadopago") {
      const preference = new Preference(client);
      const responseMP = await preference.create({
        body: {
          items: items.map((item) => {
            const rawId = String(item.articleId || item.productId || item.id || "");
            return {
              id: String(rawId.replace(/\D/g, "")),
              title: `${item.title} (${item.size.toUpperCase()})`,
              unit_price: Number(item.price),
              quantity: Number(item.quantity),
              currency_id: "ARS"
            };
          }),
          back_urls: {
            success: `${NEXT_PUBLIC_SITE_URL}/checkout/success`,
            failure: `${NEXT_PUBLIC_SITE_URL}/checkout?cancelled=true`, // 🌟 Redirige con flag de cancelación
            pending: `${NEXT_PUBLIC_SITE_URL}/checkout/pending`
          },
          binary_mode: true,
          external_reference: order.id, 
          expiration_date_to: expirationTime.toISOString(),
        }
      });

      if (responseMP.init_point) {
        return NextResponse.json({ url: responseMP.init_point, orderId: order.id });
      } else {
        throw new Error("No se recibió init_point del SDK");
      }
    }

    if (paymentMethod === "stripe") {
      return NextResponse.json({ url: `https://checkout.stripe.com/simulated?orderId=${order.id}`, orderId: order.id });
    }

    return NextResponse.json({ error: "Method not supported." }, { status: 400 });

  } catch (error: any) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 400 });
  }
}

// =========================================================================
// 🔓 LIBERACIÓN INMEDIATA DE STOCK AL CANCELAR O REGRESAR (DELETE)
// =========================================================================
export async function DELETE(req: Request) {
  try {
    console.log("=== 🧹 LIBERACIÓN ACTIVA SOLICITADA DESDE EL FRONTEND ===");
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "Falta el orderId para cancelar" }, { status: 400 });
    }

    // Buscamos la orden pendiente que coincida
    const orderToCancel = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: session.user.id,
        status: "PENDING"
      },
      include: { items: true }
    });

    if (!orderToCancel) {
      return NextResponse.json({ message: "La orden no existe o ya cambió de estado" }, { status: 200 });
    }

    // Devolvemos el stock en una sola transacción
    await prisma.$transaction(async (tx: any) => {
      for (const item of orderToCancel.items) {
        const sku = await tx.productSku.findFirst({
          where: { articleId: Number(item.productId), size: item.size }
        });
        if (sku) {
          await tx.productSku.update({
            where: { id: sku.id },
            data: { stock: sku.stock + item.quantity }
          });
        }
      }

      // Pasamos la orden a cancelada
      await tx.order.update({
        where: { id: orderToCancel.id },
        data: { status: "CANCELLED" }
      });
    });

    console.log(`✅ Stock devuelto con éxito para la orden: ${orderId}`);
    return NextResponse.json({ success: true, message: "Reserva liberada con éxito" });

  } catch (error: any) {
    console.error("Error al liberar stock activamente:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}