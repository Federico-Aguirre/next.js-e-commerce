import https from 'node:https';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { restoreOrderStock } from '@/lib/checkout/inventory';
import { amountAtExchangeRate } from '@/lib/currency/payment-amount';
import { sendLowStockAlerts, sendPaidOrderAlert } from '@/lib/order-alerts';
import { sendOrderConfirmationEmail } from '@/lib/orders/order-confirmation-email';
import { mercadoPagoPaymentConfig, platformFeeForProducts } from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';
import { calculateTaxBreakdown } from '@/lib/tax/tax-calculation';

export const dynamic = 'force-dynamic';

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

  try {
    const { accessToken, chargeEnabled, splitEnabled } = await mercadoPagoPaymentConfig();
    if (!accessToken || !chargeEnabled) {
      return NextResponse.json(
        { message: 'Mercado Pago no tiene credenciales válidas para cobrar.' },
        { status: 503 },
      );
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;

    if (!userId && !userEmail) {
      return NextResponse.json({ message: 'Debés iniciar sesión.' }, { status: 401 });
    }

    const body = await req.json();
    const orderId = String(body.orderId || '');
    pendingOrderId = orderId || null;

    if (!orderId || !body.token) {
      return NextResponse.json(
        { message: 'Faltan la orden reservada o el token de tarjeta.' },
        { status: 400 },
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(userEmail
            ? [
                {
                  user: {
                    email: userEmail,
                  },
                },
              ]
            : []),
        ],
      },
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

    if (order.status !== 'PENDING' || order.paymentProvider !== 'MERCADOPAGO') {
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
    const paymentMethodId = String(body.payment_method_id || 'master');

    console.info('Mercado Pago card token diagnostic', {
      total: transactionAmount,
      installments,
      paymentMethodId,
      tokenMetadata: body.tokenMetadata ?? null,
    });

    let paymentResponse: MercadoPagoPayment;

    if (splitEnabled) {
      const client = new MercadoPagoConfig({ accessToken });
      const payment = new Payment(client);
      paymentResponse = await payment.create({
        body: {
          transaction_amount: Number(order.paymentTotal!.toFixed(2)),
          application_fee: amountAtExchangeRate(
            platformFeeForProducts(order.items),
            'ARS',
            order.paymentExchangeRate,
          ),
          token: body.token,
          description: body.description || `Orden ${order.id}`,
          installments: Number(body.installments || 1),
          payment_method_id: body.payment_method_id,
          external_reference: order.id,
          payer: {
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
      const paymentType = await mercadoPagoPaymentType(accessToken, paymentMethodId);
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
          payer: {
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
      await prisma.$transaction(async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: order.id },
          include: { items: true },
        });

        if (!current || current.status !== 'PENDING') return;

        await restoreOrderStock(tx, current.items);
        await tx.order.update({
          where: { id: current.id },
          data: {
            status: 'PAYMENT_FAILED',
            paymentExternalId: paymentResponse.id ? String(paymentResponse.id) : null,
          },
        });
      });

      return NextResponse.json({
        ...paymentResponse,
        orderId: order.id,
      });
    }

    const updated = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: 'PENDING',
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

    await sendOrderConfirmationEmail(order.id);
    void sendPaidOrderAlert(order.id);
    await sendLowStockAlerts();

    return NextResponse.json({
      ...paymentResponse,
      orderId: order.id,
    });
  } catch (error: unknown) {
    console.error('Error procesando pago:', error);

    if (pendingOrderId && !paymentWasApproved) {
      const { accessToken, splitEnabled } = await mercadoPagoPaymentConfig();
      if (accessToken) {
        try {
          const approvedRemote = splitEnabled
            ? await findApprovedMercadoPagoPayment(accessToken, pendingOrderId)
            : await findProcessedMercadoPagoOrder(accessToken, pendingOrderId);
          if (approvedRemote?.id != null) {
            const reconciled = await prisma.order.updateMany({
              where: { id: pendingOrderId, status: 'PENDING' },
              data: {
                status: 'PAID',
                paymentProvider: 'MERCADOPAGO',
                paymentExternalId: String(approvedRemote.id),
              },
            });

            if (reconciled.count === 1) {
              paymentWasApproved = true;
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
        } catch (reconcileError) {
          console.error('No se pudo reconciliar Mercado Pago tras el error:', reconcileError);
        }
      }

      try {
        await prisma.$transaction(async (tx) => {
          const pending = await tx.order.findUnique({
            where: { id: pendingOrderId! },
            include: { items: true },
          });

          if (!pending || pending.status !== 'PENDING') return;

          await restoreOrderStock(tx, pending.items);
          await tx.order.update({
            where: { id: pending.id },
            data: { status: 'PAYMENT_FAILED' },
          });
        });
      } catch (cleanupError) {
        console.error('No se pudo liberar la reserva fallida de Mercado Pago:', cleanupError);
      }
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
