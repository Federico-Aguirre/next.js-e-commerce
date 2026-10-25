import { connection, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireDashboardAdmin } from '@/app/[locale]/dashboard/data';
import { getLatestUsdExchangeRates, getConversionRate } from '@/lib/currency/exchange-rates';
import {
  getLocalPayPalSavedCards,
  getPayPalSavedCardScope,
  getPayPalSandboxAccessToken,
  persistPayPalVaultCard,
  persistPayPalVaultCustomer,
} from '@/lib/payments/paypal-saved-cards';
import { paypalAuthAssertion } from '@/lib/payments/platform-config';
import {
  assertProPlanCanBePurchased,
  completeRegisteredProPayment,
  findProPaymentAttempt,
  ProPlanBillingError,
  registerPendingProPayment,
} from '@/lib/payments/pro-plan-billing';
import { prisma } from '@/lib/prisma';

const API = 'https://api-m.sandbox.paypal.com';
const PRICE_ARS = 75_000;
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const PayPalSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create'),
      paymentAttemptId: z.string().uuid(),
      savedPaymentMethodId: z.string().trim().min(1).max(191).optional(),
      savePaymentMethod: z.boolean().optional().default(true),
    })
    .strict()
    .refine((value) => !(value.savedPaymentMethodId && value.savePaymentMethod), {
      message: 'Elegí una tarjeta guardada o una tarjeta nueva.',
    }),
  z
    .object({
      action: z.literal('capture'),
      paymentAttemptId: z.string().uuid(),
      paypalOrderId: z.string().trim().min(1).max(191),
    })
    .strict(),
]);

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

function getBillingContext() {
  const environment =
    process.env.PAYPAL_ENVIRONMENT?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'invalid' : 'sandbox');
  const clientId = process.env.DEVELOPER_PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.DEVELOPER_PAYPAL_CLIENT_SECRET?.trim();
  const merchantId = process.env.DEVELOPER_PAYPAL_MERCHANT_ID?.trim();
  const partnerAttributionId = process.env.DEVELOPER_PAYPAL_PARTNER_ATTRIBUTION_ID?.trim();
  if (
    environment !== 'sandbox' ||
    !clientId ||
    !clientSecret ||
    !merchantId ||
    !partnerAttributionId
  )
    return null;
  const config = {
    clientId,
    clientSecret,
    sellerMerchantId: merchantId,
    partnerAttributionId,
    splitEnabled: true,
    sandbox: true,
  };
  return {
    config,
    clientId,
    clientSecret,
    merchantId,
    partnerAttributionId,
    scope: getPayPalSavedCardScope(merchantId),
  };
}

async function apiRequest<T>(
  accessToken: string,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  requestId?: string,
) {
  const context = getBillingContext();
  const response = await fetch(API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      ...(context
        ? {
            'PayPal-Auth-Assertion': paypalAuthAssertion(context.clientId, context.merchantId),
            'PayPal-Partner-Attribution-Id': context.partnerAttributionId,
          }
        : {}),
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  return { status: response.status, data: (await response.json().catch(() => ({}))) as T };
}

function expectedUsdAmount(exchangeRate: number) {
  return Math.round(PRICE_ARS * exchangeRate * 100) / 100;
}

async function quoteUsd() {
  const quote = await getLatestUsdExchangeRates();
  const exchangeRate = getConversionRate('ARS', 'USD', quote.rates);
  return { amount: expectedUsdAmount(exchangeRate), exchangeRate, updatedAt: quote.updatedAt };
}

export async function GET() {
  await connection();
  try {
    await requireDashboardAdmin();
    const context = getBillingContext();
    if (!context) return errorResponse('PAYPAL_PRO_BILLING_UNAVAILABLE', 503);

    const accessToken = await getPayPalSandboxAccessToken(context.config);
    const credentials = Buffer.from(context.clientId + ':' + context.clientSecret).toString(
      'base64',
    );
    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      response_type: 'client_token',
      intent: 'sdk_init',
    });
    const response = await fetch(API + '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + credentials,
        'Content-Type': 'application/x-www-form-urlencoded',
        'PayPal-Auth-Assertion': paypalAuthAssertion(context.clientId, context.merchantId),
        'PayPal-Partner-Attribution-Id': context.partnerAttributionId,
      },
      body: form,
      cache: 'no-store',
    });
    const token = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!response.ok || !token.access_token)
      return errorResponse('PAYPAL_CLIENT_TOKEN_FAILED', 502);
    const quote = await quoteUsd();
    // Access-token call verifies the platform credentials in the server context.
    void accessToken;
    return NextResponse.json(
      {
        clientId: context.clientId,
        clientToken: token.access_token,
        expiresIn: token.expires_in ?? 900,
        amountARS: PRICE_ARS,
        amountUSD: quote.amount,
        exchangeRate: quote.exchangeRate,
        rateUpdatedAt: quote.updatedAt,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error(
      '[pro-payment-paypal] client token failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return errorResponse('PAYPAL_CLIENT_TOKEN_FAILED', 502);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireDashboardAdmin();
    const adminUserId = admin.user.id;
    if (!adminUserId) return errorResponse('ADMIN_ID_MISSING', 401);
    const parsed = PayPalSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse('INVALID_REQUEST', 400);
    const context = getBillingContext();
    if (!context) return errorResponse('PAYPAL_PRO_BILLING_UNAVAILABLE', 503);

    if (parsed.data.action === 'create') {
      const input = parsed.data;
      const existingAttempt = await findProPaymentAttempt(input.paymentAttemptId);
      if (existingAttempt) {
        if (
          existingAttempt.adminUserId !== adminUserId ||
          existingAttempt.paymentProvider !== 'PAYPAL'
        ) {
          return errorResponse('PAYMENT_ATTEMPT_OWNER_MISMATCH', 403);
        }
        if (existingAttempt.status === 'PAID') {
          const completed = await completeRegisteredProPayment({
            adminUserId,
            provider: 'PAYPAL',
            paymentAttemptId: input.paymentAttemptId,
            providerTransactionId: existingAttempt.providerTransactionId,
          });
          return completed.activated
            ? NextResponse.json({ alreadyPaid: true, activated: true }, { headers: NO_STORE })
            : errorResponse('PAYMENT_ALREADY_RECORDED_CHECK_PLAN', 409);
        }
        if (existingAttempt.externalPaymentId && existingAttempt.status === 'PENDING') {
          return NextResponse.json(
            {
              paypalOrderId: existingAttempt.externalPaymentId,
              paymentAttemptId: input.paymentAttemptId,
              amountARS: PRICE_ARS,
              amountUSD: existingAttempt.paymentAmount,
              exchangeRate: existingAttempt.exchangeRate,
            },
            { headers: NO_STORE },
          );
        }
      }

      await assertProPlanCanBePurchased();
      const quote = await quoteUsd();
      const accessToken = await getPayPalSandboxAccessToken(context.config);
      let vaultId: string | undefined;
      let customerId: string | undefined;

      if (input.savedPaymentMethodId) {
        const savedCard = await prisma.savedPaymentMethod.findFirst({
          where: {
            id: input.savedPaymentMethodId,
            paymentCustomer: {
              userId: adminUserId,
              provider: 'PAYPAL',
              accountScope: context.scope,
            },
          },
          include: { paymentCustomer: true },
        });
        if (!savedCard) return errorResponse('SAVED_CARD_NOT_FOUND', 404);
        const remote = await apiRequest<{ id?: string; customer?: { id?: string } }>(
          accessToken,
          '/v3/vault/payment-tokens/' + encodeURIComponent(savedCard.externalCardId),
          'GET',
        );
        if (
          remote.status < 200 ||
          remote.status >= 300 ||
          remote.data.id !== savedCard.externalCardId ||
          remote.data.customer?.id !== savedCard.paymentCustomer.externalCustomerId
        ) {
          return errorResponse('SAVED_CARD_NOT_AVAILABLE', 409);
        }
        vaultId = savedCard.externalCardId;
        customerId = savedCard.paymentCustomer.externalCustomerId;
      } else if (input.savePaymentMethod) {
        const local = await getLocalPayPalSavedCards(adminUserId, context.scope);
        customerId = local.customer?.externalCustomerId;
      }

      const paymentSource = vaultId
        ? { card: { vault_id: vaultId } }
        : input.savePaymentMethod
          ? {
              card: {
                attributes: {
                  vault: {
                    store_in_vault: 'ON_SUCCESS',
                    usage_type: 'PLATFORM',
                    customer_type: 'CONSUMER',
                    permit_multiple_payment_tokens: true,
                  },
                  ...(customerId ? { customer: { id: customerId } } : {}),
                },
              },
            }
          : undefined;

      const created = await apiRequest<{
        id?: string;
        status?: string;
        links?: Array<{ rel?: string; href?: string }>;
        message?: string;
      }>(
        accessToken,
        '/v2/checkout/orders',
        'POST',
        {
          intent: 'CAPTURE',
          ...(paymentSource ? { payment_source: paymentSource } : {}),
          purchase_units: [
            {
              reference_id: input.paymentAttemptId,
              custom_id: input.paymentAttemptId,
              payee: { merchant_id: context.merchantId },
              amount: { currency_code: 'USD', value: quote.amount.toFixed(2) },
              description: 'Plan Pro mensual Nova Store',
            },
          ],
        },
        input.paymentAttemptId + '-create',
      );
      if (created.status < 200 || created.status >= 300 || !created.data.id) {
        return errorResponse('PAYPAL_ORDER_CREATE_FAILED', 502);
      }

      try {
        await registerPendingProPayment({
          adminUserId,
          provider: 'PAYPAL',
          externalPaymentId: created.data.id,
          paymentAttemptId: input.paymentAttemptId,
          paymentAmount: quote.amount,
          paymentCurrency: 'USD',
          exchangeRate: quote.exchangeRate,
          expiresAt: new Date(Date.now() + 15 * 60_000),
          savedPaymentMethodId: input.savedPaymentMethodId ?? null,
        });
      } catch (error) {
        const response =
          error instanceof ProPlanBillingError
            ? errorResponse(error.code, error.code === 'STOREFRONT_CLOSED' ? 409 : 400)
            : null;
        if (response) return response;
        throw error;
      }

      return NextResponse.json(
        {
          paypalOrderId: created.data.id,
          paymentAttemptId: input.paymentAttemptId,
          amountARS: PRICE_ARS,
          amountUSD: quote.amount,
          exchangeRate: quote.exchangeRate,
        },
        { headers: NO_STORE },
      );
    }

    const input = parsed.data;
    const payment = await findProPaymentAttempt(input.paymentAttemptId);
    if (
      !payment ||
      payment.adminUserId !== adminUserId ||
      payment.paymentProvider !== 'PAYPAL' ||
      payment.externalPaymentId !== input.paypalOrderId
    ) {
      return errorResponse('PRO_PAYMENT_NOT_FOUND', 404);
    }
    if (payment.status === 'PAID') {
      return NextResponse.json(
        { success: true, activated: true, alreadyProcessed: true },
        { headers: NO_STORE },
      );
    }
    const subscription = await prisma.storeSubscription.findUnique({
      where: { id: 'default' },
      select: {
        storefrontStatus: true,
        pendingProPaymentId: true,
        pendingProPaymentProvider: true,
      },
    });
    if (
      subscription?.storefrontStatus !== 'OPEN' ||
      subscription.pendingProPaymentId !== payment.externalPaymentId ||
      subscription.pendingProPaymentProvider !== 'PAYPAL'
    ) {
      return errorResponse('STOREFRONT_CLOSED', 409);
    }

    const accessToken = await getPayPalSandboxAccessToken(context.config);
    const orderResult = await apiRequest<{
      id?: string;
      status?: string;
      intent?: string;
      purchase_units?: Array<{
        custom_id?: string;
        payee?: { merchant_id?: string };
        amount?: { currency_code?: string; value?: string };
        payments?: {
          captures?: Array<{
            id?: string;
            status?: string;
            amount?: { currency_code?: string; value?: string };
          }>;
        };
      }>;
      payment_source?: {
        card?: {
          brand?: string;
          last_digits?: string;
          expiry?: string;
          attributes?: { vault?: { id?: string; customer?: { id?: string }; status?: string } };
        };
      };
    }>(accessToken, '/v2/checkout/orders/' + encodeURIComponent(input.paypalOrderId), 'GET');

    if (
      orderResult.status < 200 ||
      orderResult.status >= 300 ||
      orderResult.data.id !== input.paypalOrderId ||
      orderResult.data.intent !== 'CAPTURE'
    ) {
      return errorResponse('PAYPAL_ORDER_NOT_VALID', 409);
    }
    const unit = orderResult.data.purchase_units?.[0];
    if (
      unit?.custom_id !== input.paymentAttemptId ||
      unit.payee?.merchant_id !== context.merchantId ||
      unit.amount?.currency_code !== 'USD' ||
      Math.abs(Number(unit.amount.value) - payment.paymentAmount) > 0.01
    ) {
      return errorResponse('PAYPAL_PAYMENT_DETAILS_MISMATCH', 409);
    }

    let captureId: string | undefined;
    let captureStatus: string | undefined;
    let captureAmount: { currency_code?: string; value?: string } | undefined;
    let captureSource = orderResult.data.payment_source;
    if (orderResult.data.status === 'COMPLETED') {
      const capture = unit.payments?.captures?.[0];
      captureId = capture?.id;
      captureStatus = capture?.status;
      captureAmount = capture?.amount;
    } else {
      const captureResult = await apiRequest<{
        status?: string;
        purchase_units?: Array<{
          payments?: {
            captures?: Array<{
              id?: string;
              status?: string;
              amount?: { currency_code?: string; value?: string };
            }>;
          };
        }>;
        payment_source?: typeof captureSource;
      }>(
        accessToken,
        '/v2/checkout/orders/' + encodeURIComponent(input.paypalOrderId) + '/capture',
        'POST',
        {},
        input.paymentAttemptId + '-capture',
      );
      if (
        captureResult.status < 200 ||
        captureResult.status >= 300 ||
        captureResult.data.status !== 'COMPLETED'
      ) {
        return errorResponse('PAYPAL_CAPTURE_FAILED', 409);
      }
      const capture = captureResult.data.purchase_units?.[0]?.payments?.captures?.[0];
      captureId = capture?.id;
      captureStatus = capture?.status;
      captureAmount = capture?.amount;
      captureSource = captureResult.data.payment_source ?? captureSource;
    }
    if (
      !captureId ||
      captureStatus !== 'COMPLETED' ||
      captureAmount?.currency_code !== 'USD' ||
      Math.abs(Number(captureAmount.value) - payment.paymentAmount) > 0.01
    ) {
      return errorResponse('PAYPAL_CAPTURE_NOT_CONFIRMED', 409);
    }

    const cardSource = captureSource?.card;
    const vault = cardSource?.attributes?.vault;
    if (cardSource && vault?.customer?.id) {
      try {
        await persistPayPalVaultCustomer({
          userId: adminUserId,
          sellerMerchantId: context.merchantId,
          customerId: vault.customer.id,
        });
        if (vault.id) {
          await persistPayPalVaultCard({
            userId: adminUserId,
            sellerMerchantId: context.merchantId,
            card: {
              id: vault.id,
              customerId: vault.customer.id,
              brand: cardSource.brand || 'Tarjeta',
              lastDigits: cardSource.last_digits,
              expiry: cardSource.expiry,
            },
          });
        }
      } catch (error) {
        console.error(
          '[pro-payment-paypal] vault sync failed:',
          error instanceof Error ? error.name : 'UnknownError',
        );
      }
    }

    const result = await completeRegisteredProPayment({
      adminUserId,
      provider: 'PAYPAL',
      paymentAttemptId: input.paymentAttemptId,
      providerTransactionId: captureId,
    });
    if (!result.activated && result.storefrontClosed)
      return errorResponse('PAYMENT_RECORDED_STOREFRONT_CLOSED', 409);
    return NextResponse.json(
      {
        success: true,
        activated: result.activated,
        alreadyProcessed: result.alreadyProcessed,
        paidThrough: result.paidThrough.toISOString(),
        amountARS: payment.amountARS,
        amountUSD: payment.paymentAmount,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    const code = error instanceof ProPlanBillingError ? error.code : null;
    if (code)
      return errorResponse(
        code,
        code === 'STOREFRONT_CLOSED' ? 409 : code === 'PAYMENT_ATTEMPT_OWNER_MISMATCH' ? 403 : 400,
      );
    console.error(
      '[pro-payment-paypal] failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return errorResponse('PAYPAL_PRO_PAYMENT_FAILED', 502);
  }
}
