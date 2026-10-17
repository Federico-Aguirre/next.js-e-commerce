import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { authOptions } from '@/lib/auth-options';
import { resolveCartSku, restoreOrderStock } from '@/lib/checkout/inventory';
import {
  mercadoPagoPaymentConfig,
  paypalAuthAssertion,
  paypalPaymentConfig,
  platformFeeForProducts,
  stripePaymentConfig,
} from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');

  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`;
  }

  const origin = request.headers.get('origin');
  return origin || new URL(request.url).origin;
}

async function generatePayPalAccessToken() {
  const { clientId, clientSecret } = await paypalPaymentConfig();

  if (!clientId || !clientSecret) {
    throw new Error('Falta configurar la cuenta de PayPal para cobrar.');
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

async function cleanupLegacyPendingOrders(userId: string) {
  const legacyOrders = await prisma.order.findMany({
    where: {
      userId,
      status: 'PENDING',
      checkoutKey: null,
    },
    include: { items: true },
  });

  for (const order of legacyOrders) {
    let canRelease = false;

    if (order.paymentProvider === 'MERCADOPAGO' && !order.paymentExternalId) {
      canRelease = true;
    } else if (order.paymentProvider === 'STRIPE' && order.paymentExternalId) {
      const { secretKey: stripeSecretKey } = await stripePaymentConfig();
      if (!stripeSecretKey) continue;

      const stripe = new Stripe(stripeSecretKey);
      const paymentIntent = await stripe.paymentIntents.retrieve(order.paymentExternalId);
      if (paymentIntent.status === 'succeeded') continue;
      if (paymentIntent.status !== 'canceled') {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      }
      canRelease = true;
    }

    if (!canRelease) continue;

    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });
      if (!current || current.status !== 'PENDING') return;
      await restoreOrderStock(tx, current.items);
      await tx.order.update({
        where: { id: current.id },
        data: { status: 'EXPIRED' },
      });
    });
  }
}

type CartItem = {
  id?: string;
  articleId?: string | number;
  productId?: string | number;
  variantId?: string;
  colorName?: string;
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
      paymentMethod: 'mercadopago' | 'mercadopago-card' | 'stripe' | 'paypal';
      checkoutKey?: string;
    };

    const dbUser = await resolveUser(body);

    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
    }

    const checkoutKey = typeof body.checkoutKey === 'string' ? body.checkoutKey.trim() : '';
    const paymentProvider = paymentMethod.startsWith('mercadopago')
      ? 'MERCADOPAGO'
      : paymentMethod.toUpperCase();

    // Fail closed: para Mercado Pago permitimos dos modos explícitos:
    // standalone (credenciales propias del comercio, sin split) y OAuth (split de plataforma).
    if (paymentMethod.startsWith('mercadopago')) {
      const config = await mercadoPagoPaymentConfig();
      if (!config.accessToken || !config.chargeEnabled) {
        throw new Error('Mercado Pago no tiene credenciales válidas para cobrar.');
      }
    } else if (paymentMethod === 'stripe') {
      const config = await stripePaymentConfig();
      if (!config.secretKey || !config.connectedAccountId || !config.splitEnabled) {
        throw new Error(
          'Stripe está bloqueado hasta que la cuenta Connect sandbox del comercio esté activa.',
        );
      }
    } else if (paymentMethod === 'paypal') {
      const config = await paypalPaymentConfig();
      if (
        !config.clientId ||
        !config.clientSecret ||
        !config.sellerMerchantId ||
        !config.splitEnabled
      ) {
        throw new Error(
          'PayPal está bloqueado hasta que el comercio complete el onboarding sandbox con la plataforma.',
        );
      }
    }

    if (checkoutKey) {
      const existingOrder = await prisma.order.findUnique({
        where: { checkoutKey },
      });

      if (existingOrder) {
        if (
          existingOrder.userId !== dbUser.id ||
          existingOrder.paymentProvider !== paymentProvider
        ) {
          return NextResponse.json({ error: 'Checkout key inválida.' }, { status: 409 });
        }

        if (existingOrder.status !== 'PENDING') {
          return NextResponse.json(
            { error: 'Este intento de checkout ya terminó. Iniciá uno nuevo.' },
            { status: 409 },
          );
        }

        if (paymentMethod === 'mercadopago-card') {
          return NextResponse.json({ orderId: existingOrder.id, total: existingOrder.total });
        }

        if (paymentMethod === 'stripe' && existingOrder.paymentExternalId) {
          const { secretKey: stripeSecretKey } = await stripePaymentConfig();
          if (!stripeSecretKey) throw new Error('Falta configurar Stripe.');
          const stripe = new Stripe(stripeSecretKey);
          const paymentIntent = await stripe.paymentIntents.retrieve(
            existingOrder.paymentExternalId,
          );
          if (!paymentIntent.client_secret) {
            throw new Error('Stripe no devolvió un client_secret para la reserva existente.');
          }
          return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            orderId: existingOrder.id,
          });
        }

        if (paymentMethod === 'paypal' && existingOrder.paymentExternalId) {
          return NextResponse.json({
            paypalOrderId: existingOrder.paymentExternalId,
            orderId: existingOrder.id,
          });
        }
      }
    }

    await cleanupLegacyPendingOrders(dbUser.id);

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
            await restoreOrderStock(tx, oldOrder.items);
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
    // El navegador puede tener un carrito viejo. Aiven es la fuente de verdad para
    // SKU, precio y stock; nunca confiamos en esos valores enviados por el cliente.
    const order = await prisma.$transaction(
      async (tx) => {
        const groupedItems = new Map<
          string,
          {
            skuId: string;
            articleId: number;
            title: string;
            price: number;
            quantity: number;
            image: string;
            size: string;
          }
        >();

        for (const item of items) {
          const quantity = Number(item.quantity);
          if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new Error(`Cantidad inválida para "${item.title}".`);
          }

          const sku = await resolveCartSku(tx, item);
          if (!sku) {
            throw new Error(
              `No pudimos identificar el talle ${item.size || 'N/A'} de "${item.title}". Quitá el producto del carrito y volvé a agregarlo.`,
            );
          }

          const existing = groupedItems.get(sku.id);
          if (existing) {
            // El carrito garantiza una sola línea por SKU. Si llegan filas
            // duplicadas por una sincronización vieja, no las cobramos dos veces.
            existing.quantity = Math.max(existing.quantity, quantity);
          } else {
            groupedItems.set(sku.id, {
              skuId: sku.id,
              articleId: sku.articleId,
              title: sku.variant.product.name,
              price: Number(sku.variant.product.price),
              quantity,
              image: item.image || '',
              size: sku.size,
            });
          }
        }

        const resolvedItems = Array.from(groupedItems.values()).map(
          ({ skuId: _skuId, ...item }) => ({
            productId: String(item.articleId),
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            size: item.size,
          }),
        );

        for (const item of groupedItems.values()) {
          const reserved = await tx.productSku.updateMany({
            where: {
              id: item.skuId,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });

          if (reserved.count !== 1) {
            throw new Error(
              `Lo sentimos, no hay stock suficiente de "${item.title}" en talle ${item.size.toUpperCase()}.`,
            );
          }
        }

        const total = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        return tx.order.create({
          data: {
            userId: dbUser.id,
            total,
            status: 'PENDING',
            checkoutKey: checkoutKey || null,
            paymentProvider,
            expiresAt: expirationTime,
            deliveryFirstName: dbUser.firstName,
            deliveryLastName: dbUser.lastName,
            deliveryPhone: dbUser.phone,
            deliveryDni: dbUser.dni,
            deliveryStreet: dbUser.shippingStreet,
            deliveryNumber: dbUser.shippingNumber,
            deliveryApartment: dbUser.shippingApartment,
            deliveryCity: dbUser.shippingCity,
            deliveryProvince: dbUser.shippingProvince,
            deliveryPostalCode: dbUser.shippingPostalCode,
            deliveryCountry: dbUser.shippingCountry,
            items: {
              create: resolvedItems,
            },
          },
          include: { items: true },
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    const total = order.total;

    // 💳 PASARELAS DE PAGO
    if (paymentMethod === 'mercadopago-card') {
      return NextResponse.json({ orderId: order.id, total: order.total });
    }

    if (paymentMethod === 'mercadopago') {
      const { accessToken: mpToken, splitEnabled: mercadoPagoSplitEnabled } =
        await mercadoPagoPaymentConfig();
      if (!mpToken || !mercadoPagoSplitEnabled) {
        throw new Error(
          'Mercado Pago está bloqueado hasta que el comercio complete la conexión OAuth sandbox con la plataforma.',
        );
      }

      const client = new MercadoPagoConfig({ accessToken: mpToken });
      const preference = new Preference(client);
      const baseUrl = getRequestOrigin(req);
      const isHttps = baseUrl.startsWith('https://');

      const responseMP = await preference.create({
        body: {
          items: order.items.map((item) => ({
            id: item.productId,
            title: `${item.title} (${item.size.toUpperCase()})`,
            unit_price: Number(item.price),
            quantity: Number(item.quantity),
            currency_id: 'ARS',
          })),
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
          marketplace_fee: platformFeeForProducts(order.items),
        },
      });

      const redirectUrl = responseMP.sandbox_init_point || responseMP.init_point;

      if (redirectUrl) {
        return NextResponse.json({ url: redirectUrl, orderId: order.id });
      }
      throw new Error('No se pudo obtener el punto de inicio (init_point) de Mercado Pago');
    }

    if (paymentMethod === 'stripe') {
      const {
        secretKey: stripeSecretKey,
        splitEnabled: stripeSplitEnabled,
        connectedAccountId,
      } = await stripePaymentConfig();
      if (!stripeSecretKey || !stripeSplitEnabled || !connectedAccountId) {
        throw new Error(
          'Stripe está bloqueado hasta que la cuenta Connect sandbox del comercio esté activa.',
        );
      }

      const stripe = new Stripe(stripeSecretKey);
      const feeAmount = Math.round(platformFeeForProducts(order.items) * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: 'usd',
        payment_method_types: ['card'],
        application_fee_amount: feeAmount,
        transfer_data: { destination: connectedAccountId },
        metadata: {
          orderId: order.id,
          userId: dbUser.id,
        },
      });

      if (!paymentIntent.client_secret) {
        throw new Error('Stripe no devolvió un client_secret.');
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { paymentProvider: 'STRIPE', paymentExternalId: paymentIntent.id },
      });

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId: order.id,
      });
    }

    if (paymentMethod === 'paypal') {
      const paypalConfig = await paypalPaymentConfig();
      const paypalSplitEnabled =
        paypalConfig.splitEnabled && paypalConfig.clientId && paypalConfig.sellerMerchantId;
      if (!paypalSplitEnabled) {
        throw new Error(
          'PayPal está bloqueado hasta que el comercio complete el onboarding sandbox con la plataforma.',
        );
      }
      const paypalAccessToken = await generatePayPalAccessToken();
      const paypalAssertion = paypalSplitEnabled
        ? paypalAuthAssertion(paypalConfig.clientId!, paypalConfig.sellerMerchantId!)
        : undefined;

      const paypalOrderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paypalAccessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `${order.id}-create`,
          ...(paypalConfig.partnerAttributionId
            ? { 'PayPal-Partner-Attribution-Id': paypalConfig.partnerAttributionId }
            : {}),
          ...(paypalAssertion ? { 'PayPal-Auth-Assertion': paypalAssertion } : {}),
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: order.id,
              custom_id: order.id,
              payee: { merchant_id: paypalConfig.sellerMerchantId },
              payment_instruction: {
                disbursement_mode: 'INSTANT',
                platform_fees: [
                  {
                    amount: {
                      currency_code: 'USD',
                      value: platformFeeForProducts(order.items).toFixed(2),
                    },
                  },
                ],
              },
              amount: {
                currency_code: 'USD',
                value: total.toFixed(2),
              },
            },
          ],
        }),
      });

      const paypalOrder = await paypalOrderResponse.json();

      if (!paypalOrderResponse.ok || !paypalOrder.id) {
        console.error('❌ Error creando Order de PayPal:', paypalOrder);

        throw new Error(paypalOrder?.message || 'No se pudo crear la orden de PayPal.');
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { paymentProvider: 'PAYPAL', paymentExternalId: paypalOrder.id },
      });

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

    if (orderToCancel.paymentProvider === 'STRIPE' && orderToCancel.paymentExternalId) {
      const { secretKey: stripeSecretKey } = await stripePaymentConfig();
      if (!stripeSecretKey) {
        return NextResponse.json(
          { error: 'No se puede liberar la reserva de Stripe: falta configuración.' },
          { status: 500 },
        );
      }

      const stripe = new Stripe(stripeSecretKey);
      const paymentIntent = await stripe.paymentIntents.retrieve(orderToCancel.paymentExternalId);
      if (paymentIntent.status === 'succeeded') {
        return NextResponse.json(
          { error: 'El pago ya fue cobrado y la reserva no se puede liberar.' },
          { status: 409 },
        );
      }
      if (paymentIntent.status !== 'canceled') {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      }
    }

    await prisma.$transaction(
      async (tx: any) => {
        await restoreOrderStock(tx, orderToCancel.items);

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
