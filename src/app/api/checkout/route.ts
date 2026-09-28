import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

async function generatePayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Faltan PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || 'No se pudo obtener el token de PayPal.');
  }

  return data.access_token;
}

type CartItem = {
  id?: string;
  articleId?: string | number;
  productId?: string | number;
  title: string;
  price: number;
  quantity: number;
  image: string;
  size: string;
};

// 🔍 Helper de autenticación flexible (Resuelve Web, Móvil y garantiza el usuario en DB)
async function resolveUser(body: any) {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    console.log('⚠️ Petición sin cookies web válidas (App Móvil)');
  }

  const idCandidate = session?.user?.id || body?.userId || body?.user?.id;
  const emailCandidate = session?.user?.email || body?.userEmail || body?.user?.email;

  if (!idCandidate && !emailCandidate) {
    return null;
  }

  const safeEmail = emailCandidate
    ? String(emailCandidate).toLowerCase()
    : `user_${idCandidate}@placeholder.com`;

  const dbUser = await prisma.user.upsert({
    where: { email: safeEmail },
    update: {},
    create: {
      ...(idCandidate ? { id: String(idCandidate) } : {}),
      email: safeEmail,
      name: session?.user?.name || body?.user?.name || 'Usuario',
    },
  });

  return dbUser;
}

// =========================================================================
// 🚀 CREAR ORDEN Y RESERVAR STOCK (POST)
// =========================================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, paymentMethod } = body as {
      items: CartItem[];
      paymentMethod: 'mercadopago' | 'stripe' | 'paypal';
    };

    const dbUser = await resolveUser(body);

    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
    }

    const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const now = new Date();
    const expirationTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 Minutos

    // 🛡️ PASO 0: LAZY CLEANING
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      include: { items: true },
    });

    if (expiredOrders.length > 0) {
      await prisma.$transaction(
        async (tx: any) => {
          for (const oldOrder of expiredOrders) {
            for (const oldItem of oldOrder.items) {
              await tx.productSku.updateMany({
                where: {
                  articleId: Number(oldItem.productId),
                  size: oldItem.size,
                },
                data: { stock: { increment: oldItem.quantity } },
              });
            }
          }

          const expiredIds = expiredOrders.map((o: { id: string }) => o.id);
          await tx.order.updateMany({
            where: { id: { in: expiredIds } },
            data: { status: 'EXPIRED' },
          });
        },
        { maxWait: 10_000, timeout: 20_000 },
      );
    }

    // 🔒 TRANSACCIÓN PRINCIPAL DE COMPRA
    const order = await prisma.$transaction(
      async (tx: any) => {
        for (const item of items) {
          const rawId = String(item.articleId || item.productId || item.id || '');
          if (!rawId) {
            throw new Error(`Estructura de producto inválida.`);
          }

          const numericArticleId = Number(rawId.replaceAll(/\D/g, ''));
          const sku = await tx.productSku.findFirst({
            where: { articleId: numericArticleId, size: item.size },
          });

          if (!sku || sku.stock < item.quantity) {
            throw new Error(
              `Lo sentimos, no hay stock suficiente de "${item.title}" en talle ${item.size ? item.size.toUpperCase() : 'N/A'}.`,
            );
          }

          await tx.productSku.update({
            where: { id: sku.id },
            data: { stock: sku.stock - item.quantity },
          });
        }

        return await tx.order.create({
          data: {
            userId: dbUser.id,
            total,
            status: 'PENDING',
            expiresAt: expirationTime,
            items: {
              create: items.map((item) => {
                const rawId = String(item.articleId || item.productId || item.id || '');
                return {
                  productId: String(rawId.replaceAll(/\D/g, '')),
                  title: item.title,
                  price: item.price,
                  quantity: item.quantity,
                  image: item.image,
                  size: item.size || 'UNICO',
                };
              }),
            },
          },
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    // 💳 PASARELAS DE PAGO
    if (paymentMethod === 'mercadopago') {
      const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!mpToken) {
        throw new Error('Falta la variable MERCADOPAGO_ACCESS_TOKEN.');
      }

      const client = new MercadoPagoConfig({ accessToken: mpToken });
      const preference = new Preference(client);
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
      const isHttps = baseUrl.startsWith('https://');

      const responseMP = await preference.create({
        body: {
          items: items.map((item) => {
            const rawId = String(item.articleId || item.productId || item.id || '');
            return {
              id: String(rawId.replaceAll(/\D/g, '')) || 'item',
              title: `${item.title} ${item.size ? `(${item.size.toUpperCase()})` : ''}`.trim(),
              unit_price: Number(item.price),
              quantity: Number(item.quantity),
              currency_id: 'ARS',
            };
          }),
          payer: {
            email: 'comprador.test@gmail.com',
          },
          binary_mode: false,
          ...(isHttps ? { auto_return: 'approved' } : {}),
          back_urls: {
            success: `${baseUrl}/checkout/success`,
            failure: `${baseUrl}/checkout/failure`,
            pending: `${baseUrl}/checkout/pending`,
          },
          external_reference: order.id,
          expiration_date_to: expirationTime.toISOString(),
        },
      });

      const redirectUrl = responseMP.sandbox_init_point || responseMP.init_point;

      if (redirectUrl) {
        return NextResponse.json({ url: redirectUrl, orderId: order.id });
      }
      throw new Error('No se pudo obtener el punto de inicio (init_point) de Mercado Pago');
    }

    if (paymentMethod === 'stripe') {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        throw new Error('Falta configurar STRIPE_SECRET_KEY.');
      }

      const stripe = new Stripe(stripeSecretKey);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          orderId: order.id,
          userId: dbUser.id,
        },
      });

      if (!paymentIntent.client_secret) {
        throw new Error('Stripe no devolvió un client_secret.');
      }

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId: order.id,
      });
    }

    if (paymentMethod === 'paypal') {
      const paypalAccessToken = await generatePayPalAccessToken();

      const paypalOrderResponse = await fetch(
        'https://api-m.sandbox.paypal.com/v2/checkout/orders',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paypalAccessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': `${order.id}-create`,
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
              {
                reference_id: order.id,
                custom_id: order.id,
                amount: {
                  currency_code: 'USD',
                  value: total.toFixed(2),
                },
              },
            ],
          }),
        },
      );

      const paypalOrder = await paypalOrderResponse.json();

      if (!paypalOrderResponse.ok || !paypalOrder.id) {
        console.error('❌ Error creando Order de PayPal:', paypalOrder);

        throw new Error(paypalOrder?.message || 'No se pudo crear la orden de PayPal.');
      }

      return NextResponse.json({
        paypalOrderId: paypalOrder.id,
        orderId: order.id,
      });
    }

    return NextResponse.json({ error: 'Method not supported.' }, { status: 400 });
  } catch (error: any) {
    console.error('=== 🚨 CHECKOUT ERROR ===', error);
    return NextResponse.json(
      {
        error: error?.message || 'Internal Server Error',
        details: error?.cause || error?.api_response || null,
      },
      { status: 400 },
    );
  }
}

// =========================================================================
// 🔓 LIBERACIÓN INMEDIATA DE STOCK AL CANCELAR O REGRESAR (DELETE)
// =========================================================================
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { orderId } = body;

    const dbUser = await resolveUser(body);

    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Falta el orderId para cancelar' }, { status: 400 });
    }

    const orderToCancel = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: dbUser.id,
        status: 'PENDING',
      },
      include: { items: true },
    });

    if (!orderToCancel) {
      return NextResponse.json(
        { message: 'La orden no existe o ya cambió de estado' },
        { status: 200 },
      );
    }

    await prisma.$transaction(
      async (tx: any) => {
        for (const item of orderToCancel.items) {
          await tx.productSku.updateMany({
            where: { articleId: Number(item.productId), size: item.size },
            data: { stock: { increment: item.quantity } },
          });
        }

        await tx.order.update({
          where: { id: orderToCancel.id },
          data: { status: 'CANCELLED' },
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    return NextResponse.json({
      success: true,
      message: 'Reserva liberada con éxito',
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
