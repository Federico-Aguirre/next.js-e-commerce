import https from 'node:https';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { restoreOrderStock } from '@/lib/checkout/inventory';
import { amountAtExchangeRate } from '@/lib/currency/payment-amount';
import { sendLowStockAlerts, sendPaidOrderAlert } from '@/lib/order-alerts';
import { sendOrderConfirmationEmail } from '@/lib/orders/order-confirmation-email';
import { getMercadoPagoSavedCardScope } from '@/lib/payments/mercadopago-saved-cards';
import {
  mercadoPagoPaymentConfig,
  platformFeeForProducts,
  refreshPlatformSubscriptionPlan,
} from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';
import { calculateTaxBreakdown } from '@/lib/tax/tax-calculation';

type MercadoPagoPayment = {
  id?: string | number;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  message?: string;
  error?: string;
  cause?: unknown;
};

type MercadoPagoOrderPayment = {
  id?: string;
  status?: string;
  status_detail?: string;
  payment_method?: {
    id?: string;
    type?: string;
  };
};

type MercadoPagoOrderError = {
  code?: string;
  message?: string;
  details?: string | string[] | Record<string, unknown>;
};

type MercadoPagoOrder = {
  id?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transactions?: {
    payments?: MercadoPagoOrderPayment[];
  };
  message?: string;
  error?: string;
  cause?: unknown;
  errors?: MercadoPagoOrderError[];
};

type MercadoPagoPaymentMethod = {
  id?: string;
  payment_type_id?: string;
};

type MercadoPagoHttpResult<T> = {
  status: number;
  requestId: string | null;
  data: T;
};

const ProcessPaymentSchema = z
  .object({
    orderId: z.string().trim().min(1).max(191),
    token: z.string().trim().min(1).max(8192),
    installments: z.coerce.number().int().min(1).max(24).optional(),
    payment_method_id: z.string().trim().min(1).max(64).optional(),
    issuer_id: z.string().trim().max(64).optional(),
    description: z.string().trim().max(200).optional(),
    email: z.string().trim().email().max(254).optional(),
    docType: z.string().trim().max(16).optional(),
    docNumber: z
      .string()
      .trim()
      .regex(/^\d{5,20}$/)
      .optional(),
    savedPaymentMethodId: z.string().trim().min(1).max(191).optional(),
  })
  .passthrough();

async function mercadoPagoRequest<T>({
  accessToken,
  path,
  method = 'GET',
  body,
  idempotencyKey,
  dnsRetries = 2,
}: {
  accessToken: string;
  path: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  idempotencyKey?: string;
  dnsRetries?: number;
}): Promise<MercadoPagoHttpResult<T>> {
  const payload = body === undefined ? null : JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: 'https:',
        hostname: 'api.mercadopago.com',
        port: 443,
        path,
        method,
        family: 4,
        agent: false,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data: T;

          try {
            data = (raw ? JSON.parse(raw) : {}) as T;
          } catch {
            data = {} as T;
          }

          const rawRequestId = response.headers['x-request-id'];
          const requestId = Array.isArray(rawRequestId)
            ? (rawRequestId[0] ?? null)
            : (rawRequestId ?? null);

          resolve({
            status: response.statusCode ?? 0,
            requestId,
            data,
          });
        });
      },
    );

    request.setTimeout(15_000, () => {
      request.destroy(new Error('Timeout conectando con Mercado Pago.'));
    });
    request.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EAI_AGAIN' && dnsRetries > 0) {
        const retryDelayMs = dnsRetries === 2 ? 250 : 750;
        setTimeout(() => {
          void mercadoPagoRequest<T>({
            accessToken,
            path,
            method,
            body,
            idempotencyKey,
            dnsRetries: dnsRetries - 1,
          }).then(resolve, reject);
        }, retryDelayMs);
        return;
      }

      reject(error);
    });

    if (payload) request.write(payload);
    request.end();
  });
}

async function mercadoPagoPaymentType(accessToken: string, paymentMethodId: string) {
  const response = await mercadoPagoRequest<MercadoPagoPaymentMethod[]>({
    accessToken,
    path: '/v1/payment_methods',
  });
  if (response.status < 200 || response.status >= 300) return 'credit_card';
  return (
    response.data.find((method) => method.id === paymentMethodId)?.payment_type_id || 'credit_card'
  );
}

async function findProcessedMercadoPagoOrder(accessToken: string, externalReference: string) {
  const now = Date.now();
  const beginDate = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(now + 5 * 60 * 1000).toISOString();
  const query = new URLSearchParams({
    begin_date: beginDate,
    end_date: endDate,
    external_reference: externalReference,
    type: 'online',
  });
  const response = await mercadoPagoRequest<{ data?: MercadoPagoOrder[] }>({
    accessToken,
    path: `/v1/orders?${query.toString()}`,
  });
  if (response.status < 200 || response.status >= 300) return null;

  return (
    response.data.data?.find((order) => {
      const transaction = order.transactions?.payments?.[0];
      return (
        order.external_reference === externalReference &&
        order.status === 'processed' &&
        order.status_detail === 'accredited' &&
        transaction?.status === 'processed' &&
        transaction.status_detail === 'accredited'
      );
    }) ?? null
  );
}

async function findApprovedMercadoPagoPayment(accessToken: string, externalReference: string) {
  const response = await mercadoPagoRequest<{ results?: MercadoPagoPayment[] }>({
    accessToken,
    path: `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}`,
  });

  if (response.status < 200 || response.status >= 300) return null;

  return (
    response.data.results?.find(
      (payment) =>
        payment.external_reference === externalReference &&
        payment.status === 'approved' &&
        payment.status_detail === 'accredited',
    ) ?? null
  );
}

export async function POST(req: Request) {
  let pendingOrderId: string | null = null;
  let paymentWasApproved = false;
  let paymentClaimed = false;

  try {
    const authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) {
      return NextResponse.json({ message: 'Debés iniciar sesión.' }, { status: 401 });
    }
    const userId = authenticatedUser.id;
    const userEmail = authenticatedUser.email;
    const rateLimit = checkRateLimit('process-payment:' + hashRateLimitIdentity(userId), {
      limit: 8,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: 'Demasiados intentos de pago. Esperá un minuto y volvé a intentar.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const parsedBody = ProcessPaymentSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { message: 'Los datos de pago o la reserva son inválidos.' },
        { status: 400 },
      );
    }
    const body = parsedBody.data;
    const orderId = body.orderId;
    pendingOrderId = orderId;

    if (userEmail === null) {
      return NextResponse.json(
        { message: 'La cuenta no tiene un correo asociado.' },
        { status: 400 },
      );
    }

    const paymentConfig = await mercadoPagoPaymentConfig();
    const { accessToken, chargeEnabled, splitEnabled } = paymentConfig;
    if (!accessToken || !chargeEnabled) {
      return NextResponse.json(
        { message: 'Mercado Pago no tiene credenciales válidas para cobrar.' },
        { status: 503 },
      );
    }

    let savedPaymentMethod:
      | (NonNullable<Awaited<ReturnType<typeof prisma.savedPaymentMethod.findFirst>>> & {
          paymentCustomer: { externalCustomerId: string };
        })
      | null = null;
    if (body.savedPaymentMethodId) {
      if (paymentConfig.sandbox !== true) {
        return NextResponse.json(
          { message: 'El pago con tarjetas guardadas solo está habilitado en sandbox por ahora.' },
          { status: 503 },
        );
      }

      const accountScope = getMercadoPagoSavedCardScope({
        accessToken,
        splitEnabled,
        externalAccountId: paymentConfig.externalAccountId,
      });
      savedPaymentMethod = await prisma.savedPaymentMethod.findFirst({
        where: {
          id: body.savedPaymentMethodId,
          paymentCustomer: {
            is: {
              userId,
              provider: 'MERCADOPAGO',
              accountScope,
            },
          },
        },
        include: { paymentCustomer: { select: { externalCustomerId: true } } },
      });

      if (!savedPaymentMethod) {
        return NextResponse.json(
          { message: 'La tarjeta guardada no pertenece a esta cuenta o ya no está disponible.' },
          { status: 404 },
        );
      }
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ message: 'No se encontró la orden reservada.' }, { status: 404 });
    }

    if (order.status === 'PAID') {
      await sendOrderConfirmationEmail(order.id);
      return NextResponse.json({
        id: order.paymentExternalId,
        orderId: order.id,
        status: 'approved',
        status_detail: 'accredited',
        alreadyConfirmed: true,
      });
    }

    if (
      order.status !== 'PENDING' ||
      order.paymentProvider !== 'MERCADOPAGO' ||
      order.expiresAt.getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { message: 'La orden ya no está disponible para pagar.' },
        { status: 409 },
      );
    }

    if (
      order.paymentCurrency !== 'ARS' ||
      order.paymentTotal === null ||
      order.paymentExchangeRate === null ||
      order.taxRate === null ||
      order.taxCalculationMethod === null
    ) {
      return NextResponse.json(
        {
          message:
            'Esta reserva no tiene un cálculo de impuestos válido guardado. Volvé al carrito e iniciá el checkout nuevamente.',
        },
        { status: 409 },
      );
    }

    const payerEmail = String(body.email || userEmail || '').trim();
    if (!payerEmail) {
      throw new Error('Falta el email del comprador para Mercado Pago.');
    }

    const transactionAmount = Number(order.paymentTotal.toFixed(2));
    const installments = Number(body.installments || 1);
    const paymentMethodId =
      savedPaymentMethod?.paymentMethodId || String(body.payment_method_id || 'master');

    const processingClaim = await prisma.order.updateMany({
      where: {
        id: order.id,
        userId: order.userId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      data: { status: 'PAYMENT_PROCESSING' },
    });
    if (processingClaim.count !== 1) {
      return NextResponse.json(
        { message: 'La reserva venció o ya está siendo procesada.' },
        { status: 409 },
      );
    }
    paymentClaimed = true;

    let paymentResponse: MercadoPagoPayment;

    if (splitEnabled) {
      const client = new MercadoPagoConfig({ accessToken });
      const payment = new Payment(client);
      paymentResponse = await payment.create({
        body: {
          transaction_amount: Number(order.paymentTotal!.toFixed(2)),
          application_fee: amountAtExchangeRate(
            await platformFeeForProducts(order.items, order.id),
            'ARS',
            order.paymentExchangeRate,
          ),
          token: body.token,
          description: body.description || `Orden ${order.id}`,
          installments: Number(body.installments || 1),
          payment_method_id: paymentMethodId,
          external_reference: order.id,
          payer: savedPaymentMethod
            ? {
                type: 'customer',
                id: savedPaymentMethod.paymentCustomer.externalCustomerId,
              }
            : {
                email: body.email || userEmail || undefined,
                identification:
                  body.docType && body.docNumber
                    ? {
                        type: body.docType,
                        number: body.docNumber,
                      }
                    : undefined,
              },
          additional_info: {
            items: order.items.map((item) => ({
              id: item.productId,
              title: item.title,
              quantity: item.quantity,
              unit_price: amountAtExchangeRate(
                calculateTaxBreakdown(
                  item.price,
                  order.taxRate,
                  order.currency,
                  order.taxCalculationMethod === 'tax_inclusive_base'
                    ? 'tax_inclusive_base'
                    : 'tax_exclusive_base',
                ).total,
                'ARS',
                order.paymentExchangeRate!,
              ),
            })),
          },
        },
        requestOptions: {
          idempotencyKey: `order-${order.id}`,
        },
      });
    } else {
      const paymentType =
        savedPaymentMethod?.paymentType ||
        (await mercadoPagoPaymentType(accessToken, paymentMethodId));
      const orderResponse = await mercadoPagoRequest<MercadoPagoOrder>({
        accessToken,
        path: '/v1/orders',
        method: 'POST',
        idempotencyKey: order.id,
        body: {
          type: 'online',
          processing_mode: 'automatic',
          total_amount: transactionAmount.toFixed(2),
          external_reference: order.id,
          payer: savedPaymentMethod
            ? { customer_id: savedPaymentMethod.paymentCustomer.externalCustomerId }
            : {
                email: payerEmail,
                identification:
                  body.docType && body.docNumber
                    ? { type: body.docType, number: body.docNumber }
                    : undefined,
              },
          transactions: {
            payments: [
              {
                amount: transactionAmount.toFixed(2),
                payment_method: {
                  id: paymentMethodId,
                  type: paymentType,
                  token: body.token,
                  installments,
                },
              },
            ],
          },
        },
      });

      if (orderResponse.status < 200 || orderResponse.status >= 300) {
        const orderErrors = Array.isArray(orderResponse.data.errors)
          ? orderResponse.data.errors
          : [];
        const orderErrorMessage = orderErrors
          .map((item) => [item.code, item.message].filter(Boolean).join(': '))
          .filter(Boolean)
          .join(' | ');

        console.error('Mercado Pago Orders API error', {
          status: orderResponse.status,
          requestId: orderResponse.requestId,
          errors: orderErrors,
          message: orderResponse.data.message ?? null,
          error: orderResponse.data.error ?? null,
        });

        const error = new Error(
          orderResponse.data.message ||
            orderResponse.data.error ||
            orderErrorMessage ||
            'Mercado Pago rechazó la order.',
        ) as Error & {
          requestId?: string | null;
          status?: number;
          error?: string;
          causes?: unknown[];
        };
        error.requestId = orderResponse.requestId;
        error.status = orderResponse.status;
        error.error = orderResponse.data.error || orderErrors[0]?.code;
        error.causes = orderErrors.length > 0 ? orderErrors : undefined;
        throw error;
      }

      const transaction = orderResponse.data.transactions?.payments?.[0];
      const approved =
        orderResponse.data.status === 'processed' &&
        orderResponse.data.status_detail === 'accredited' &&
        transaction?.status === 'processed' &&
        transaction.status_detail === 'accredited';

      paymentResponse = {
        id: orderResponse.data.id,
        status: approved ? 'approved' : orderResponse.data.status,
        status_detail: orderResponse.data.status_detail,
        external_reference: order.id,
      };
    }

    const approved =
      paymentResponse.status === 'approved' && paymentResponse.status_detail === 'accredited';
    paymentWasApproved = approved;

    if (!approved) {
      const status = String(paymentResponse.status ?? '').toLowerCase();
      const terminalFailure = new Set([
        'rejected',
        'cancelled',
        'canceled',
        'expired',
        'charged_back',
        'refunded',
      ]).has(status);
      const externalId = paymentResponse.id ? String(paymentResponse.id) : null;

      if (terminalFailure) {
        await prisma.$transaction(async (tx) => {
          const finalized = await tx.order.updateMany({
            where: { id: order.id, status: 'PAYMENT_PROCESSING' },
            data: { status: 'PAYMENT_FAILED', paymentExternalId: externalId },
          });
          if (finalized.count !== 1) return;
          await restoreOrderStock(tx, order.items);
        });
        paymentClaimed = false;
      } else if (externalId) {
        await prisma.order.updateMany({
          where: { id: order.id, status: 'PAYMENT_PROCESSING' },
          data: { paymentExternalId: externalId },
        });
      }

      // Unknown or pending provider states keep the reservation locked until
      // the scheduled reconciler can safely determine the final payment result.
      return NextResponse.json({
        ...paymentResponse,
        orderId: order.id,
      });
    }

    const updated = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: 'PAYMENT_PROCESSING',
      },
      data: {
        status: 'PAID',
        paymentProvider: 'MERCADOPAGO',
        paymentExternalId: String(paymentResponse.id),
      },
    });

    if (updated.count !== 1) {
      throw new Error('El pago fue aprobado pero la orden cambió de estado antes de confirmarse.');
    }

    await refreshPlatformSubscriptionPlan();
    await sendOrderConfirmationEmail(order.id);
    void sendPaidOrderAlert(order.id);
    await sendLowStockAlerts();

    return NextResponse.json({
      ...paymentResponse,
      orderId: order.id,
    });
  } catch (error: unknown) {
    console.error('Error procesando pago:', error);

    if (pendingOrderId && paymentClaimed && !paymentWasApproved) {
      try {
        const { accessToken, splitEnabled } = await mercadoPagoPaymentConfig();
        if (accessToken) {
          const approvedRemote = splitEnabled
            ? await findApprovedMercadoPagoPayment(accessToken, pendingOrderId)
            : await findProcessedMercadoPagoOrder(accessToken, pendingOrderId);
          if (approvedRemote?.id != null) {
            const reconciled = await prisma.order.updateMany({
              where: { id: pendingOrderId, status: 'PAYMENT_PROCESSING' },
              data: {
                status: 'PAID',
                paymentProvider: 'MERCADOPAGO',
                paymentExternalId: String(approvedRemote.id),
              },
            });

            if (reconciled.count === 1) {
              paymentWasApproved = true;
              paymentClaimed = false;
              await refreshPlatformSubscriptionPlan();
              await sendOrderConfirmationEmail(pendingOrderId);
              void sendPaidOrderAlert(pendingOrderId);
              await sendLowStockAlerts();
              return NextResponse.json({
                id: approvedRemote.id,
                orderId: pendingOrderId,
                status: 'approved',
                status_detail: 'accredited',
                reconciled: true,
              });
            }
          }
        }
      } catch (reconcileError) {
        console.error('Mercado Pago reconciliation deferred to the scheduled job.', {
          orderId: pendingOrderId,
          error: reconcileError instanceof Error ? reconcileError.name : 'UnknownError',
        });
      }
      // Do not restore stock after an ambiguous provider error. The scheduled
      // reconciliation will confirm approval or expire the reservation later.
    }

    const mpError = error as Error & {
      requestId?: string | null;
      status?: number;
      error?: string;
      causes?: unknown[];
    };
    const responseStatus = mpError.status && mpError.status >= 500 ? 502 : 400;

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Error al procesar el pago.',
        requestId: mpError.requestId ?? null,
        mercadoPagoStatus: mpError.status ?? null,
        mercadoPagoError: mpError.error ?? null,
        mercadoPagoCauses: mpError.causes ?? null,
      },
      { status: responseStatus },
    );
  }
}
