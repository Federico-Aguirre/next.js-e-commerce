import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Preference } from "mercadopago";

const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const dynamic = 'force-dynamic';

// Inicializamos el cliente oficial de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
}

export async function POST(req: Request) {
  try {
    console.log("=== 🚀 ¡EL BACKEND ESTÁ EJECUTANDO ESTE CÓDIGO ESPECÍFICO! ===");
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { items, paymentMethod } = await req.json() as { items: CartItem[], paymentMethod: 'mercadopago' | 'stripe' };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

    // 1. Grabamos la orden en tu base de datos de Aiven con estado PENDING
    const order = await prisma.order.create({
      data: {
        userId: session.user.id,
        total,
        status: "PENDING",
        items: {
          create: items.map((item) => ({
            productId: String(item.id),
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
          })),
        },
      },
    });

    // 2. Lógica de Mercado Pago usando el SDK Oficial
    if (paymentMethod === "mercadopago") {
      console.log("=== 🚀 CREANDO PREFERENCIA CON EL SDK OFICIAL DE MP ===");

      // Instanciamos la clase Preference pasándole el cliente configurado
      const preference = new Preference(client);

      // Creamos la preferencia de forma nativa
      // Creamos la preferencia de forma nativa
      // En tu archivo src/app/api/checkout/route.ts

const responseMP = await preference.create({
  body: {
    items: items.map((item) => ({
      id: String(item.id),
      title: String(item.title),
      unit_price: Number(item.price),
      quantity: Number(item.quantity),
      currency_id: "ARS"
    })),
    
    back_urls: {
      success: `${NEXT_PUBLIC_SITE_URL}/checkout/success`,
      failure: `${NEXT_PUBLIC_SITE_URL}/checkout/failure`,
      pending: `${NEXT_PUBLIC_SITE_URL}/checkout/pending`
    },
    
    // ❌ BORRADO/COMENTADO PARA SIEMPRE EN LOCAL (Evita el error de raíz)
    // auto_return: "approved",
    
    // ⚡ MODO BINARIO: Fuerza a Mercado Pago a definir el pago rápido y mostrar el botón de salida
    binary_mode: true,
    
    external_reference: order.id, 
  }
});

      if (responseMP.init_point) {
        return NextResponse.json({ url: responseMP.init_point });
      } else {
        throw new Error("No se recibió init_point del SDK de Mercado Pago");
      }
    }

    // 3. Lógica de Stripe simulada
    if (paymentMethod === "stripe") {
      return NextResponse.json({ url: `https://checkout.stripe.com/simulated?orderId=${order.id}` });
    }

    return NextResponse.json({ error: "Method not supported." }, { status: 400 });

  } catch (error: any) {
    console.error("Checkout Processing Error Completo:", error);
    
    // Extraemos de forma segura el mensaje de error del SDK si viene de Mercado Pago
    const errorMessage = error?.message || error?.cause?.message || "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}