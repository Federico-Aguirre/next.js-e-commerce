import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { isCheckoutProfileComplete } from '@/lib/account/checkout-profile';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { resolveCartSku, restoreOrderStock } from '@/lib/checkout/inventory';
import { roundCurrencyAmount } from '@/lib/currency/currencies';
import { amountInPaymentCurrency } from '@/lib/currency/payment-amount';
import type { PaymentConversion, ProviderCurrency } from '@/lib/currency/payment-amount';
import { expireStaleCheckoutOrders } from '@/lib/orders/expired-checkout-cleanup';
import { sendOrderConfirmationEmail } from '@/lib/orders/order-confirmation-email';
import {
  buildPayPalOrderCardSource,
  getPayPalSavedCardScope,
  getPayPalSandboxAccessToken,
  getPayPalVaultHeaders,
} from '@/lib/payments/paypal-saved-cards';
import {
  mercadoPagoPaymentConfig,
  paypalAuthAssertion,
  paypalPaymentConfig,
  platformFeeForProducts,
  refreshPlatformSubscriptionPlan,
  stripePaymentConfig,
} from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';
import { verifyCheckoutQuoteToken } from '@/lib/shipping/checkout-quote-token';
import type { CheckoutShippingOption } from '@/lib/shipping/types';
import {
  StorefrontClosedError,
  getStorefrontStatus,
  lockOpenStorefrontForNewOrder,
} from '@/lib/storefront/storefront-status';
import { calculateBasketTax, calculateTaxBreakdown } from '@/lib/tax/tax-calculation';
import { getCountryTaxProfile } from '@/lib/tax/tax-rates';
import { StoreConfig } from '@/utils/StoreConfig';

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

const CheckoutIdSchema = z.union([
  z.string().trim().min(1).max(191),
  z.number().int().positive().safe(),
]);

const CheckoutRequestSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: CheckoutIdSchema.optional(),
          articleId: CheckoutIdSchema.optional(),
          productId: CheckoutIdSchema.optional(),
          variantId: z.string().trim().min(1).max(191).optional(),
          colorName: z.string().trim().max(100).optional(),
          title: z.string().trim().max(200).optional().default(''),
          price: z.coerce.number().finite().nonnegative().optional(),
          quantity: z.coerce.number().int().min(1).max(99),
          image: z.string().max(2048).optional().default(''),
          size: z.string().trim().min(1).max(32),
        }),
      )
      .min(1)
      .max(100),
    paymentMethod: z.enum(['mercadopago', 'mercadopago-card', 'stripe', 'paypal']),
    checkoutKey: z.string().uuid().optional(),
    savePaymentMethod: z.boolean().optional().default(false),
    savedPaymentMethodId: z.string().trim().min(1).max(191).optional(),
    deliveryAddressId: z.string().trim().min(1).max(191).optional(),
    shippingQuoteToken: z.string().min(1).max(20_000),
  })
  .superRefine((value, ctx) => {
    if (
      (value.savePaymentMethod || value.savedPaymentMethodId) &&
      value.paymentMethod !== 'paypal'
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'El guardado de tarjetas indicado no corresponde a PayPal.',
      });
    }
    if (value.savePaymentMethod && value.savedPaymentMethodId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Elegí guardar una tarjeta nueva o usar una guardada, no ambas opciones.',
      });
    }
  });

// =========================================================================
// 🚀 CREAR ORDEN Y RESERVAR STOCK (POST)
// =========================================================================
export async function POST(req: Request) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > 100_000) {
      return NextResponse.json(
        { error: 'La solicitud de checkout supera el tamaño permitido.' },
        { status: 413 },
      );
    }

    const parsedBody = CheckoutRequestSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'El carrito o el medio de pago contiene datos inválidos.' },
        { status: 400 },
      );
    }
    const {
      items,
      paymentMethod,
      checkoutKey = '',
      savePaymentMethod = false,
      savedPaymentMethodId,
      deliveryAddressId: requestedDeliveryAddressId,
      shippingQuoteToken,
    } = parsedBody.data;

    const dbUser = await getAuthenticatedUser(req);

    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`checkout:${hashRateLimitIdentity(dbUser.id)}`, {
      limit: 12,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos de checkout. Esperá un minuto y volvé a intentar.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
    }

    const savedAddress = await prisma.deliveryAddress.findFirst({
      where: {
        userId: dbUser.id,
        ...(requestedDeliveryAddressId ? { id: requestedDeliveryAddressId } : { isDefault: true }),
      },
    });
    if (!savedAddress) {
      return NextResponse.json(
        {
          code: 'DELIVERY_ADDRESS_REQUIRED',
          error:
            'Guardá o elegí una dirección de entrega en Mi cuenta antes de realizar la compra.',
          accountUrl: '/account',
        },
        { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    const checkoutUser = {
      ...dbUser,
      deliveryAddressId: savedAddress.id,
      shippingStreet: savedAddress.shippingStreet,
      shippingNumber: savedAddress.shippingNumber,
      shippingApartment: savedAddress.shippingApartment,
      shippingCity: savedAddress.shippingCity,
      shippingProvince: savedAddress.shippingProvince,
      shippingPostalCode: savedAddress.shippingPostalCode,
      shippingCountry: savedAddress.shippingCountry,
    };

    if (!isCheckoutProfileComplete(checkoutUser)) {
      return NextResponse.json(
        {
          code: 'PROFILE_INCOMPLETE',
          error:
            'Completá y guardá tus datos personales y dirección de entrega en Mi cuenta antes de realizar la compra.',
          accountUrl: '/account',
        },
        { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    const paymentProvider = paymentMethod.startsWith('mercadopago')
      ? 'MERCADOPAGO'
      : paymentMethod.toUpperCase();
    // Stripe supports ARS card payments, so its charge matches the store's final ARS total.
    // PayPal's Orders API does not support ARS and remains USD-only.
    const paymentCurrency: ProviderCurrency =
      paymentMethod.startsWith('mercadopago') || paymentMethod === 'stripe' ? 'ARS' : 'USD';

    let shippingSelection: CheckoutShippingOption;
    try {
      shippingSelection = verifyCheckoutQuoteToken(shippingQuoteToken, checkoutUser, items);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Volvé a cotizar el envío.' },
        { status: 422 },
      );
    }
    if (shippingSelection.paymentCurrency !== paymentCurrency) {
      return NextResponse.json(
        { error: 'La cotización fue emitida para otra moneda de pago. Volvé a cotizar el envío.' },
        { status: 422 },
      );
    }

    let paypalConfigForCheckout: Awaited<ReturnType<typeof paypalPaymentConfig>> | null = null;
    let paypalAccessTokenForCheckout: string | undefined;
    let paypalSavedCardForCheckout: {
      id: string;
      externalCardId: string;
      paymentCustomer: { id: string; externalCustomerId: string };
    } | null = null;
    let paypalVaultCustomerId: string | undefined;

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
      paypalConfigForCheckout = config;
      if (
        !config.clientId ||
        !config.clientSecret ||
        !config.sellerMerchantId ||
        !config.splitEnabled ||
        config.sandbox !== true
      ) {
        throw new Error(
          'PayPal está bloqueado hasta que el comercio complete el onboarding sandbox con la plataforma.',
        );
      }

      const accountScope = getPayPalSavedCardScope(config.sellerMerchantId);
      if (savedPaymentMethodId) {
        const savedCard = await prisma.savedPaymentMethod.findFirst({
          where: {
            id: savedPaymentMethodId,
            paymentCustomer: {
              userId: dbUser.id,
              provider: 'PAYPAL',
              accountScope,
            },
          },
          include: { paymentCustomer: true },
        });
        if (!savedCard) {
          return NextResponse.json(
            { error: 'La tarjeta guardada no pertenece a tu cuenta de PayPal.' },
            { status: 404, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
          );
        }

        paypalAccessTokenForCheckout = await getPayPalSandboxAccessToken(config);
        const remoteTokenResponse = await fetch(
          `https://api-m.sandbox.paypal.com/v3/vault/payment-tokens/${encodeURIComponent(savedCard.externalCardId)}`,
          {
            headers: getPayPalVaultHeaders(config, paypalAccessTokenForCheckout),
            cache: 'no-store',
          },
        );
        const remoteToken = (await remoteTokenResponse.json().catch(() => ({}))) as {
          id?: string;
          customer?: { id?: string };
        };
        if (
          !remoteTokenResponse.ok ||
          remoteToken.id !== savedCard.externalCardId ||
          remoteToken.customer?.id !== savedCard.paymentCustomer.externalCustomerId
        ) {
          return NextResponse.json(
            {
              error:
                'PayPal ya no reconoce esa tarjeta guardada. Actualizá la lista e intentá de nuevo.',
            },
            { status: 409, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
          );
        }
        paypalSavedCardForCheckout = {
          id: savedCard.id,
          externalCardId: savedCard.externalCardId,
          paymentCustomer: {
            id: savedCard.paymentCustomer.id,
            externalCustomerId: savedCard.paymentCustomer.externalCustomerId,
          },
        };
      }

      if (savePaymentMethod) {
        const existingPayPalCustomer = await prisma.paymentCustomer.findUnique({
          where: {
            userId_provider_accountScope: {
              userId: dbUser.id,
              provider: 'PAYPAL',
              accountScope,
            },
          },
          select: { externalCustomerId: true },
        });
        paypalVaultCustomerId = existingPayPalCustomer?.externalCustomerId;
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

        if (existingOrder.expiresAt.getTime() <= Date.now()) {
          return NextResponse.json(
            { error: 'La reserva venció. Iniciá un checkout nuevo.' },
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
            paymentTotal: paymentIntent.amount / 100,
            paymentCurrency: paymentIntent.currency.toUpperCase(),
            totalInStoreCurrency: existingOrder.total,
            subtotal: existingOrder.subtotal,
            taxAmount: existingOrder.taxAmount,
            taxRate: existingOrder.taxRate,
            taxCalculationMethod: existingOrder.taxCalculationMethod,
            taxName: existingOrder.taxName,
            taxCountry: existingOrder.taxCountry,
            currency: existingOrder.currency,
          });
        }

        if (paymentMethod === 'paypal' && existingOrder.paymentExternalId) {
          return NextResponse.json({
            paypalOrderId: existingOrder.paymentExternalId,
            orderId: existingOrder.id,
            paymentTotal: existingOrder.paymentTotal,
            paymentCurrency: existingOrder.paymentCurrency,
            totalInStoreCurrency: existingOrder.total,
            subtotal: existingOrder.subtotal,
            taxAmount: existingOrder.taxAmount,
            taxRate: existingOrder.taxRate,
            taxCalculationMethod: existingOrder.taxCalculationMethod,
            taxName: existingOrder.taxName,
            taxCountry: existingOrder.taxCountry,
            currency: existingOrder.currency,
          });
        }
      }
    }

    // A retry with an existing checkoutKey has already returned above so an order
    // accepted before closure can keep paying. Only a brand-new order is blocked.
    let storefrontStatus: 'OPEN' | 'CLOSED';
    try {
      storefrontStatus = await getStorefrontStatus();
    } catch (error) {
      console.error('[checkout] storefront status unavailable:', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      return NextResponse.json(
        {
          code: 'STOREFRONT_UNAVAILABLE',
          error: 'La tienda no está disponible temporalmente. No se inició ninguna compra nueva.',
        },
        { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    if (storefrontStatus !== 'OPEN') {
      return NextResponse.json(
        {
          code: 'STOREFRONT_CLOSED',
          error:
            'La tienda está dada de baja y no acepta compras nuevas. Los pedidos ya iniciados pueden continuar.',
        },
        { status: 409, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    // The catalogue is fixed in ARS before tax. Save the destination's rate with the order;
    // payment gateways receive the item totals including that saved tax snapshot.
    const taxProfile = await getCountryTaxProfile(checkoutUser.shippingCountry || 'Argentina');
    if (!taxProfile || taxProfile.status !== 'standard' || taxProfile.rate === null) {
      throw new Error(
        `No se puede confirmar el impuesto para ${checkoutUser.shippingCountry || 'el destino seleccionado'}. Completá una dirección de entrega válida o conectá una configuración fiscal para esa jurisdicción antes de pagar.`,
      );
    }
    if (
      taxProfile.countryCode !== shippingSelection.taxCountry ||
      taxProfile.calculationMethod !== shippingSelection.taxCalculationMethod ||
      Math.abs(taxProfile.rate - shippingSelection.taxRate) > 0.0001 ||
      shippingSelection.storeCurrency !== StoreConfig.currency
    ) {
      throw new Error('Cambió la configuración fiscal. Volvé a cotizar el envío antes de pagar.');
    }
    const taxRate = taxProfile.rate;
    const paymentConversion: PaymentConversion = {
      paymentCurrency,
      exchangeRate: shippingSelection.paymentExchangeRate,
      rates: null,
    };

    // Opportunistically clean a few of this customer's stale reservations.
    // The scheduled job handles the global queue; provider verification prevents
    // restoring stock while an external payment is still pending or approved.
    await expireStaleCheckoutOrders({ limit: 3, userId: dbUser.id });

    const now = new Date();
    const expirationTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    // 🔒 TRANSACCIÓN PRINCIPAL DE COMPRA
    // El navegador puede tener un carrito viejo. Aiven es la fuente de verdad para
    // SKU, precio y stock; nunca confiamos en esos valores enviados por el cliente.
    const order = await prisma.$transaction(
      async (tx) => {
        // Re-check while locking the same row used by the closure transition.
        // If the store closes now, the stock changes below are rolled back.
        await lockOpenStorefrontForNewOrder(tx);

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

        const taxBreakdown = calculateBasketTax(
          resolvedItems,
          taxRate,
          StoreConfig.currency,
          taxProfile?.calculationMethod,
        );
        const subtotal = taxBreakdown.subtotal;
        const taxAmount = taxBreakdown.taxAmount;
        const productTotal = taxBreakdown.total;
        if (
          Math.abs(productTotal - shippingSelection.productTotal) > 0.02 ||
          Math.abs(subtotal - shippingSelection.subtotal) > 0.02 ||
          Math.abs(taxAmount - shippingSelection.taxAmount) > 0.02
        ) {
          throw new Error(
            'Cambió el precio de un producto. Actualizá la cotización del envío y revisá el total.',
          );
        }
        const shippingAmount = roundCurrencyAmount(
          shippingSelection.shippingAmount,
          StoreConfig.currency,
        );
        const total = roundCurrencyAmount(productTotal + shippingAmount, StoreConfig.currency);

        // Keep product rounding consistent with the quote and add the previously quoted delivery fee.
        const productPaymentTotal = roundCurrencyAmount(
          resolvedItems.reduce((sum, item) => {
            const grossUnitPrice = calculateTaxBreakdown(
              item.price,
              taxRate,
              StoreConfig.currency,
              taxProfile?.calculationMethod,
            ).total;
            return sum + amountInPaymentCurrency(grossUnitPrice, paymentConversion) * item.quantity;
          }, 0),
          paymentCurrency,
        );
        const paymentTotal = roundCurrencyAmount(
          productPaymentTotal + shippingSelection.paymentShippingAmount,
          paymentCurrency,
        );
        if (
          Math.abs(paymentTotal - shippingSelection.paymentTotal) > 0.02 ||
          Math.abs(total - shippingSelection.totalInStoreCurrency) > 0.02
        ) {
          throw new Error(
            'El total cambió desde la cotización del envío. Volvé a cotizar antes de pagar.',
          );
        }

        return tx.order.create({
          data: {
            userId: dbUser.id,
            subtotal,
            taxAmount,
            taxRate: taxProfile?.rate ?? null,
            taxCalculationMethod: taxProfile?.calculationMethod ?? null,
            taxCountry: taxProfile?.countryCode ?? null,
            taxName: taxProfile?.taxName ?? null,
            total,
            shippingAmount,
            shippingQuoteRate: shippingSelection.amount,
            shippingQuoteCurrency: shippingSelection.currency,
            currency: StoreConfig.currency,
            paymentCurrency,
            paymentTotal,
            paymentExchangeRate: paymentConversion.exchangeRate,
            status: 'PENDING',
            checkoutKey: checkoutKey || null,
            paymentProvider,
            expiresAt: expirationTime,
            deliveryFirstName: checkoutUser.firstName,
            deliveryLastName: checkoutUser.lastName,
            deliveryPhone: checkoutUser.phone,
            deliveryDni: checkoutUser.dni,
            deliveryStreet: checkoutUser.shippingStreet,
            deliveryNumber: checkoutUser.shippingNumber,
            deliveryApartment: checkoutUser.shippingApartment,
            deliveryCity: checkoutUser.shippingCity,
            deliveryProvince: checkoutUser.shippingProvince,
            deliveryPostalCode: checkoutUser.shippingPostalCode,
            deliveryCountry: checkoutUser.shippingCountry,
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
      return NextResponse.json({
        orderId: order.id,
        total: order.total,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        taxRate: order.taxRate,
        taxCalculationMethod: order.taxCalculationMethod,
        taxName: order.taxName,
        taxCountry: order.taxCountry,
        currency: order.currency,
      });
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
          items: [
            ...order.items.map((item) => ({
              id: item.productId,
              title: `${item.title} (${item.size.toUpperCase()})`,
              unit_price: amountInPaymentCurrency(
                calculateTaxBreakdown(
                  Number(item.price),
                  order.taxRate,
                  StoreConfig.currency,
                  order.taxCalculationMethod === 'tax_inclusive_base'
                    ? 'tax_inclusive_base'
                    : 'tax_exclusive_base',
                ).total,
                paymentConversion,
              ),
              quantity: Number(item.quantity),
              currency_id: 'ARS',
            })),
            ...(order.shippingAmount > 0
              ? [
                  {
                    id: `shipping-${order.id}`,
                    title: `Envío${shippingSelection.carrier ? ` - ${shippingSelection.carrier}` : ''}`,
                    unit_price: amountInPaymentCurrency(order.shippingAmount, paymentConversion),
                    quantity: 1,
                    currency_id: 'ARS',
                  },
                ]
              : []),
          ],
          ...(dbUser.email ? { payer: { email: dbUser.email } } : {}),
          binary_mode: false,
          ...(isHttps ? { auto_return: 'approved' } : {}),
          back_urls: {
            success: `${baseUrl}/checkout/success`,
            failure: `${baseUrl}/checkout/failure`,
            pending: `${baseUrl}/checkout/pending`,
          },
          external_reference: order.id,
          expiration_date_to: expirationTime.toISOString(),
          marketplace_fee: amountInPaymentCurrency(
            await platformFeeForProducts(order.items, order.id),
            paymentConversion,
          ),
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
      const feeAmount = Math.round(
        amountInPaymentCurrency(
          await platformFeeForProducts(order.items, order.id),
          paymentConversion,
        ) * 100,
      );

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round((order.paymentTotal ?? total) * 100),
        currency: order.paymentCurrency.toLowerCase(),
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
        paymentTotal: order.paymentTotal,
        paymentCurrency: order.paymentCurrency,
        totalInStoreCurrency: order.total,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        taxRate: order.taxRate,
        taxCalculationMethod: order.taxCalculationMethod,
        taxName: order.taxName,
        taxCountry: order.taxCountry,
        currency: order.currency,
      });
    }

    if (paymentMethod === 'paypal') {
      const paypalConfig = paypalConfigForCheckout ?? (await paypalPaymentConfig());
      const paypalSplitEnabled =
        paypalConfig.splitEnabled && paypalConfig.clientId && paypalConfig.sellerMerchantId;
      if (!paypalSplitEnabled || paypalConfig.sandbox !== true) {
        throw new Error(
          'PayPal está bloqueado hasta que el comercio complete el onboarding sandbox con la plataforma.',
        );
      }
      const paypalAccessToken = paypalAccessTokenForCheckout || (await generatePayPalAccessToken());
      const paypalAssertion = paypalSplitEnabled
        ? paypalAuthAssertion(paypalConfig.clientId!, paypalConfig.sellerMerchantId!)
        : undefined;

      const paypalCardPaymentSource = buildPayPalOrderCardSource({
        savedPaymentMethodId: paypalSavedCardForCheckout?.externalCardId,
        savePaymentMethod,
        existingCustomerId: paypalVaultCustomerId,
      });

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
          ...(paypalCardPaymentSource ? { payment_source: paypalCardPaymentSource } : {}),
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
                      value: amountInPaymentCurrency(
                        await platformFeeForProducts(order.items, order.id),
                        paymentConversion,
                      ).toFixed(2),
                    },
                  },
                ],
              },
              amount: {
                currency_code: 'USD',
                value: (order.paymentTotal ?? total).toFixed(2),
              },
            },
          ],
        }),
      });

      const paypalOrder = await paypalOrderResponse.json();

      if (!paypalOrderResponse.ok || !paypalOrder.id) {
        console.error('PayPal order creation failed.', {
          status: paypalOrderResponse.status,
          providerName: typeof paypalOrder?.name === 'string' ? paypalOrder.name : 'unknown',
          savingCard: savePaymentMethod,
          usingSavedCard: Boolean(paypalSavedCardForCheckout),
        });

        // A deterministic provider-side 4xx means no PayPal order was created.
        // Release this reservation atomically so a Vault eligibility error does
        // not lock the buyer's stock for the full checkout timeout. Leave 5xx
        // and ambiguous responses for reconciliation to avoid a double sale.
        if (paypalOrderResponse.status >= 400 && paypalOrderResponse.status < 500) {
          try {
            await prisma.$transaction(
              async (tx) => {
                const cancelled = await tx.order.updateMany({
                  where: {
                    id: order.id,
                    userId: dbUser.id,
                    status: 'PENDING',
                    paymentProvider: 'PAYPAL',
                    paymentExternalId: null,
                  },
                  data: { status: 'CANCELLED' },
                });
                if (cancelled.count === 1) await restoreOrderStock(tx, order.items);
              },
              { maxWait: 10_000, timeout: 20_000 },
            );
          } catch (releaseError) {
            console.error('[checkout] PayPal rejected the order and reservation release failed.', {
              errorName: releaseError instanceof Error ? releaseError.name : 'UnknownError',
            });
          }
        }

        const message = savePaymentMethod
          ? 'PayPal no aceptó guardar la tarjeta. Puede que Vault no esté habilitado para esta cuenta sandbox; desmarcá la opción e intentá pagar de nuevo.'
          : paypalSavedCardForCheckout
            ? 'PayPal no pudo iniciar el pago con la tarjeta guardada. Actualizá tus tarjetas o elegí otra.'
            : 'No se pudo crear la orden de PayPal.';
        throw new Error(message);
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { paymentProvider: 'PAYPAL', paymentExternalId: paypalOrder.id },
      });

      return NextResponse.json({
        paypalOrderId: paypalOrder.id,
        orderId: order.id,
        paymentTotal: order.paymentTotal,
        paymentCurrency: order.paymentCurrency,
        totalInStoreCurrency: order.total,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        taxRate: order.taxRate,
        taxCalculationMethod: order.taxCalculationMethod,
        taxName: order.taxName,
        taxCountry: order.taxCountry,
        currency: order.currency,
      });
    }

    return NextResponse.json({ error: 'Method not supported.' }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof StorefrontClosedError) {
      return NextResponse.json(
        {
          code: 'STOREFRONT_CLOSED',
          error:
            'La tienda se dio de baja antes de crear la orden. No se reservó stock ni se inició un cobro nuevo.',
        },
        { status: 409, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    console.error('[checkout] failed:', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    const safeProviderMessage = error instanceof Error ? error.message : '';
    const allowedPayPalMessages = [
      'PayPal no aceptó guardar la tarjeta.',
      'PayPal no pudo iniciar el pago con la tarjeta guardada.',
    ];
    const publicMessage = allowedPayPalMessages.some((prefix) =>
      safeProviderMessage.startsWith(prefix),
    )
      ? safeProviderMessage
      : 'No se pudo iniciar el checkout. Revisá los datos e intentá nuevamente.';
    return NextResponse.json(
      { error: publicMessage },
      { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }
}

// =========================================================================
// Release a checkout reservation only after the payment path is safely stopped.
// =========================================================================
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { orderId } = body;
    const dbUser = await getAuthenticatedUser(req);

    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (typeof orderId !== 'string' || !orderId) {
      return NextResponse.json({ error: 'Falta el orderId para cancelar' }, { status: 400 });
    }

    const orderToCancel = await prisma.order.findFirst({
      where: { id: orderId, userId: dbUser.id, status: 'PENDING' },
      include: { items: true },
    });
    if (!orderToCancel) {
      return NextResponse.json(
        { message: 'La reserva no existe o ya cambió de estado.' },
        { status: 409 },
      );
    }
    if (orderToCancel.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { message: 'La reserva ya venció y se liberará mediante la limpieza programada.' },
        { status: 409 },
      );
    }

    // Mercado Pago Checkout Pro preferences are not persisted as an external ID.
    // Do not restore stock while the customer could still complete that provider flow.
    if (orderToCancel.paymentProvider !== 'PAYPAL' && orderToCancel.paymentProvider !== 'STRIPE') {
      return NextResponse.json(
        { message: 'Este medio de pago se liberará automáticamente al vencer la reserva.' },
        { status: 409 },
      );
    }

    const claim = await prisma.order.updateMany({
      where: {
        id: orderToCancel.id,
        userId: dbUser.id,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        paymentProvider: orderToCancel.paymentProvider,
        paymentExternalId: orderToCancel.paymentExternalId,
      },
      data: { status: 'CANCELLING' },
    });
    if (claim.count !== 1) {
      return NextResponse.json(
        { message: 'La reserva ya está siendo procesada.' },
        { status: 409 },
      );
    }

    if (orderToCancel.paymentProvider === 'STRIPE' && orderToCancel.paymentExternalId) {
      try {
        const { secretKey } = await stripePaymentConfig();
        if (!secretKey) throw new Error('Stripe is not configured.');
        const stripe = new Stripe(secretKey);
        let intent = await stripe.paymentIntents.retrieve(orderToCancel.paymentExternalId);

        if (intent.status !== 'succeeded' && intent.status !== 'canceled') {
          intent = await stripe.paymentIntents.cancel(intent.id);
        }
        if (intent.status !== 'succeeded' && intent.status !== 'canceled') {
          intent = await stripe.paymentIntents.retrieve(orderToCancel.paymentExternalId);
        }

        if (intent.status === 'succeeded') {
          const paid = await prisma.order.updateMany({
            where: { id: orderToCancel.id, status: 'CANCELLING' },
            data: {
              status: 'PAID',
              paymentProvider: 'STRIPE',
              paymentExternalId: intent.id,
            },
          });
          if (paid.count === 1) {
            await refreshPlatformSubscriptionPlan();
            await sendOrderConfirmationEmail(orderToCancel.id);
          }
          return NextResponse.json(
            { message: 'El proveedor confirmó el pago; no se liberó el stock.' },
            { status: 409 },
          );
        }
        if (intent.status !== 'canceled') throw new Error('Stripe cancellation was not confirmed.');
      } catch {
        await prisma.order.updateMany({
          where: { id: orderToCancel.id, status: 'CANCELLING' },
          data: { status: 'PENDING' },
        });
        return NextResponse.json(
          {
            error:
              'No se pudo confirmar la cancelación del pago. La reserva se conserva por seguridad.',
          },
          { status: 502 },
        );
      }
    }

    const restored = await prisma.$transaction(
      async (tx) => {
        const finalized = await tx.order.updateMany({
          where: { id: orderToCancel.id, status: 'CANCELLING' },
          data: { status: 'CANCELLED' },
        });
        if (finalized.count !== 1) return false;
        await restoreOrderStock(tx, orderToCancel.items);
        return true;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    if (!restored) {
      return NextResponse.json(
        { message: 'La reserva cambió de estado; no se liberó stock.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, message: 'Reserva liberada con éxito.' });
  } catch (error) {
    console.error('Checkout reservation cancellation failed.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
