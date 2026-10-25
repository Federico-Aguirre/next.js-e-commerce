import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
// Orders are bound to the authenticated account and provider-side order ID.
import { sendLowStockAlerts, sendPaidOrderAlert } from '@/lib/order-alerts';
import { sendOrderConfirmationEmail } from '@/lib/orders/order-confirmation-email';
import {
  getPayPalSavedCardScope,
  persistPayPalVaultCard,
  persistPayPalVaultCustomer,
} from '@/lib/payments/paypal-saved-cards';
import {
  paypalAuthAssertion,
  paypalPaymentConfig,
  refreshPlatformSubscriptionPlan,
} from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const CapturePayPalSchema = z
  .object({
    paypalOrderId: z.string().trim().min(1).max(255),
    orderId: z.string().trim().min(1).max(191),
    savedPaymentMethodId: z.string().trim().min(1).max(191).optional(),
  })
  .strict();

type PayPalCaptureData = {
  status?: string;
  message?: string;
  details?: Array<{ description?: string }>;
  payment_source?: {
    card?: {
      vault_id?: string;
      brand?: string;
      type?: string;
      last_digits?: string;
      'last-digits'?: string;
      expiry?: string;
      attributes?: {
        vault?: {
          id?: string;
          status?: string;
          customer?: { id?: string };
        };
      };
    };
  };
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
};

async function getPayPalAccessToken(configInput?: Awaited<ReturnType<typeof paypalPaymentConfig>>) {
  const { clientId, clientSecret } = configInput ?? (await paypalPaymentConfig());

  if (!clientId || !clientSecret) {
    throw new Error('Falta configurar PayPal.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error('❌ Error obteniendo token de PayPal:', {
      status: response.status,
      data,
    });

    throw new Error(data.error_description || data.message || 'No se pudo autenticar con PayPal.');
  }

  return data.access_token as string;
}

export async function POST(request: Request) {
  try {
    const dbUser = await getAuthenticatedUser(request);
    if (!dbUser) {
      return NextResponse.json(
        { message: 'No hay una sesión de usuario válida.' },
        { status: 401, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    const rateLimit = checkRateLimit('paypal-capture:' + hashRateLimitIdentity(dbUser.id), {
      limit: 8,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: 'Demasiados intentos de captura. Volvé a intentar en un minuto.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
            'Cache-Control': 'private, no-store, max-age=0',
          },
        },
      );
    }

    const parsed = CapturePayPalSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Faltan identificadores válidos para capturar el pago.' },
        { status: 400 },
      );
    }

    const { paypalOrderId, orderId: localOrderId, savedPaymentMethodId } = parsed.data;
    console.info('PayPal capture requested.', { localOrderId });

    const order = await prisma.order.findFirst({
      where: { id: localOrderId, userId: dbUser.id },
    });

    if (!order) {
      console.error('❌ Orden local inexistente:', localOrderId);

      return NextResponse.json(
        {
          message: 'No se encontró la orden.',
        },
        {
          status: 404,
        },
      );
    }

    if (order.status === 'PAID') {
      await sendOrderConfirmationEmail(order.id);
      return NextResponse.json(
        {
          success: true,
          message: 'La orden ya estaba pagada.',
          order,
        },
        {
          status: 200,
        },
      );
    }

    if (
      order.status !== 'PENDING' ||
      order.expiresAt.getTime() <= Date.now() ||
      order.paymentProvider !== 'PAYPAL' ||
      order.paymentExternalId !== String(paypalOrderId)
    ) {
      return NextResponse.json(
        { message: 'La reserva ya no está disponible para capturar.' },
        { status: 409 },
      );
    }

    const paypalConfig = await paypalPaymentConfig();
    if (
      !paypalConfig.sandbox ||
      !paypalConfig.splitEnabled ||
      !paypalConfig.clientId ||
      !paypalConfig.sellerMerchantId
    ) {
      return NextResponse.json(
        { message: 'PayPal está bloqueado hasta que el comercio complete el onboarding sandbox.' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    let selectedSavedCard: {
      id: string;
      externalCardId: string;
      paymentCustomer: { id: string; externalCustomerId: string };
    } | null = null;
    if (savedPaymentMethodId) {
      const accountScope = getPayPalSavedCardScope(paypalConfig.sellerMerchantId);
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
          { message: 'La tarjeta guardada no pertenece a tu cuenta.' },
          { status: 404, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
        );
      }
      selectedSavedCard = {
        id: savedCard.id,
        externalCardId: savedCard.externalCardId,
        paymentCustomer: {
          id: savedCard.paymentCustomer.id,
          externalCustomerId: savedCard.paymentCustomer.externalCustomerId,
        },
      };
    }

    const captureClaim = await prisma.order.updateMany({
      where: {
        id: localOrderId,
        userId: dbUser.id,
        status: 'PENDING',
        paymentProvider: 'PAYPAL',
        paymentExternalId: String(paypalOrderId),
        expiresAt: { gt: new Date() },
      },
      data: { status: 'PAYMENT_PROCESSING' },
    });
    if (captureClaim.count !== 1) {
      return NextResponse.json(
        { message: 'La reserva venció o ya está siendo procesada.' },
        { status: 409 },
      );
    }

    const accessToken = await getPayPalAccessToken(paypalConfig);
    const paypalAssertion =
      paypalConfig.splitEnabled && paypalConfig.clientId && paypalConfig.sellerMerchantId
        ? paypalAuthAssertion(paypalConfig.clientId, paypalConfig.sellerMerchantId)
        : undefined;

    // Re-check the provider-side order before capturing any money. Its local
    // reference and exact currency/amount must match the reservation we own.
    const orderCheckResponse = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,
      {
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          ...(paypalConfig.partnerAttributionId
            ? { 'PayPal-Partner-Attribution-Id': paypalConfig.partnerAttributionId }
            : {}),
          ...(paypalAssertion ? { 'PayPal-Auth-Assertion': paypalAssertion } : {}),
        },
        cache: 'no-store',
      },
    );
    const orderCheckData = (await orderCheckResponse.json()) as PayPalCaptureData;
    const providerUnit = Array.isArray(orderCheckData.purchase_units)
      ? orderCheckData.purchase_units.find(
          (unit: { custom_id?: string; reference_id?: string }) =>
            unit.custom_id === order.id || unit.reference_id === order.id,
        )
      : undefined;
    const providerAmount = providerUnit?.amount;
    const amountMatches =
      order.paymentTotal !== null &&
      providerAmount?.currency_code === order.paymentCurrency &&
      Number.isFinite(Number(providerAmount?.value)) &&
      Number(Number(providerAmount.value).toFixed(2)) === Number(order.paymentTotal.toFixed(2));

    const providerVaultId = orderCheckData.payment_source?.card?.vault_id;
    const providerCaptures = Array.isArray(providerUnit?.payments?.captures)
      ? providerUnit.payments.captures
      : [];
    const alreadyCompletedCapture = providerCaptures.find(
      (candidate: { id?: string; status?: string }) =>
        candidate.status === 'COMPLETED' &&
        typeof candidate.id === 'string' &&
        candidate.id.length > 0,
    );
    const providerOrderAlreadyCaptured =
      orderCheckData.status === 'COMPLETED' && Boolean(alreadyCompletedCapture);
    const providerStatusAcceptable =
      orderCheckData.status === 'APPROVED' ||
      (Boolean(selectedSavedCard) &&
        orderCheckData.status === 'CREATED' &&
        providerVaultId === selectedSavedCard?.externalCardId) ||
      providerOrderAlreadyCaptured;
    // A saved-card order was created server-side with its verified vault ID. If
    // PayPal returns the source ID, it must still match; some completed-order
    // responses omit that field after processing, so verify capture/amount too.
    const savedCardMatchesProviderOrder =
      !selectedSavedCard ||
      !providerVaultId ||
      providerVaultId === selectedSavedCard.externalCardId;
    if (
      !orderCheckResponse.ok ||
      !providerStatusAcceptable ||
      !savedCardMatchesProviderOrder ||
      !providerUnit ||
      !amountMatches
    ) {
      await prisma.order.updateMany({
        where: {
          id: localOrderId,
          userId: dbUser.id,
          status: 'PAYMENT_PROCESSING',
          paymentProvider: 'PAYPAL',
          paymentExternalId: String(paypalOrderId),
        },
        data: { status: 'PENDING' },
      });
      return NextResponse.json(
        {
          message:
            'La orden de PayPal no coincide con el importe reservado; no se realizó la captura.',
        },
        { status: 409 },
      );
    }

    let captureData: PayPalCaptureData;
    let captureResponseStatus = orderCheckResponse.status;
    let captureResponseOk = true;

    if (providerOrderAlreadyCaptured && providerUnit) {
      // Card Fields / vaulted-card checkout can finish capture while creating
      // the order. Reuse the verified completed capture rather than POSTing a
      // second capture request to PayPal.
      captureData = {
        status: 'COMPLETED',
        payment_source: orderCheckData.payment_source,
        purchase_units: [providerUnit],
      };
    } else {
      const captureResponse = await fetch(
        `${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            ...(paypalConfig.partnerAttributionId
              ? { 'PayPal-Partner-Attribution-Id': paypalConfig.partnerAttributionId }
              : {}),
            ...(paypalAssertion ? { 'PayPal-Auth-Assertion': paypalAssertion } : {}),
          },
          body: JSON.stringify({}),
        },
      );

      captureResponseStatus = captureResponse.status;
      captureResponseOk = captureResponse.ok;
      captureData = (await captureResponse.json()) as PayPalCaptureData;
    }

    console.info('PayPal capture response received.', {
      status: captureResponseStatus,
      ok: captureResponseOk,
      alreadyCompleted: providerOrderAlreadyCaptured,
      providerStatus: typeof captureData.status === 'string' ? captureData.status : 'unknown',
    });

    if (!captureResponseOk) {
      return NextResponse.json(
        {
          message:
            captureData.details?.[0]?.description ||
            captureData.message ||
            'PayPal rechazó la captura del pago.',
        },
        {
          status: 502,
        },
      );
    }

    if (captureData.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          message: `PayPal no completó el pago. Estado: ${captureData.status || 'desconocido'}.`,
        },
        {
          status: 400,
        },
      );
    }

    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id;
    if (!captureId) {
      return NextResponse.json(
        { message: 'PayPal completó el pago pero no devolvió el capture ID.' },
        { status: 502 },
      );
    }

    const capturedAmount = Number(capture.amount?.value);
    const capturedAmountMatches =
      order.paymentTotal !== null &&
      capture.amount?.currency_code === order.paymentCurrency &&
      Number.isFinite(capturedAmount) &&
      Number(capturedAmount.toFixed(2)) === Number(order.paymentTotal.toFixed(2));
    if (!capturedAmountMatches) {
      // The provider says money was captured, but the amount differs: keep stock
      // reserved and prevent fulfillment until a human reconciles the discrepancy.
      await prisma.order.updateMany({
        where: {
          id: localOrderId,
          userId: dbUser.id,
          status: 'PAYMENT_PROCESSING',
          paymentProvider: 'PAYPAL',
          paymentExternalId: String(paypalOrderId),
        },
        data: {
          status: 'PAYMENT_REVIEW',
          paymentExternalId: String(captureId),
        },
      });
      return NextResponse.json(
        {
          message:
            'PayPal capturó un importe distinto al reservado. El pedido requiere revisión manual.',
        },
        { status: 409 },
      );
    }

    const finalized = await prisma.order.updateMany({
      where: {
        id: localOrderId,
        userId: dbUser.id,
        status: 'PAYMENT_PROCESSING',
        paymentProvider: 'PAYPAL',
        paymentExternalId: String(paypalOrderId),
      },
      data: {
        status: 'PAID',
        paymentExternalId: captureId,
      },
    });

    if (finalized.count !== 1) {
      return NextResponse.json(
        { message: 'PayPal completó el pago; el pedido se conciliará automáticamente.' },
        { status: 409 },
      );
    }

    await refreshPlatformSubscriptionPlan();

    const updatedOrder = await prisma.order.findUnique({
      where: { id: localOrderId },
      include: { items: true },
    });
    if (!updatedOrder) throw new Error('No se pudo recuperar el pedido capturado.');

    // PayPal only returns a reusable vault ID after the payment is authorized/captured.
    // Persist masked metadata best-effort; an already captured order must stay paid even
    // if PayPal's vault propagation or our local metadata write is temporarily delayed.
    const cardSource = captureData.payment_source?.card;
    const vault = cardSource?.attributes?.vault;
    const vaultCustomerId = vault?.customer?.id;
    if (cardSource && vaultCustomerId && paypalConfig.sellerMerchantId) {
      try {
        // Persist the provider customer even when PayPal returns VAULT status
        // APPROVED before exposing a token ID. The following private GET can
        // reconcile the token list once PayPal finishes its asynchronous vaulting.
        await persistPayPalVaultCustomer({
          userId: dbUser.id,
          sellerMerchantId: paypalConfig.sellerMerchantId,
          customerId: String(vaultCustomerId),
        });

        if (vault.id && vault.status !== 'APPROVED') {
          await persistPayPalVaultCard({
            userId: dbUser.id,
            sellerMerchantId: paypalConfig.sellerMerchantId,
            card: {
              id: String(vault.id),
              customerId: String(vaultCustomerId),
              brand: cardSource.brand || cardSource.type || 'Tarjeta',
              lastDigits: cardSource.last_digits || cardSource['last-digits'],
              expiry: cardSource.expiry,
            },
          });
        }
      } catch (vaultError) {
        console.error(
          '[paypal-capture] saved-card sync failed:',
          vaultError instanceof Error ? vaultError.name : 'UnknownError',
        );
      }
    }

    await sendOrderConfirmationEmail(updatedOrder.id);
    void sendPaidOrderAlert(updatedOrder.id);
    await sendLowStockAlerts();

    console.log('✅ ORDEN PAYPAL CONFIRMADA', {
      localOrderId,
      paypalOrderId,
      status: updatedOrder.status,
    });

    return NextResponse.json(
      {
        success: true,
        order: updatedOrder,
      },
      {
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error('PayPal capture failed.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Error interno al capturar el pago de PayPal.',
      },
      {
        status: 500,
      },
    );
  }
}
