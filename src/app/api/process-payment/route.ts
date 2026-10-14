import https from 'node:https';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { restoreOrderStock } from '@/lib/checkout/inventory';
import { sendLowStockAlerts, sendPaidOrderAlert } from '@/lib/order-alerts';
import { mercadoPagoPaymentConfig, platformFee } from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';

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
    const { accessToken, splitEnabled } = mercadoPagoPaymentConfig();
    if (!accessToken) {
      return NextResponse.json(
        { message: 'Falta configurar la cuenta de Mercado Pago del comercio.' },
        { status: 500 },
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

    const payerEmail = String(body.email || userEmail || '').trim();
    if (!payerEmail) {
      throw new Error('Falta el email del comprador para Mercado Pago.');
    }

    const transactionAmount = Number(order.total.toFixed(2));
    const installments = Number(body.installments || 1);
    const paymentMethodId = String(body.payment_method_id || 'master');

    console.info('Mercado Pago card token diagnostic', {
      total: transactionAmount,
      installments,
      paymentMethodId,
      tokenMetadata: body.tokenMetadata ?? null,
    });

    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    const paymentResponse = await payment.create({
      body: {
        transaction_amount: Number(order.total.toFixed(2)),
        application_fee: splitEnabled ? platformFee(order.total) : undefined,
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
            unit_price: item.price,
          })),
        },
      },
      requestOptions: {
        idempotencyKey: `order-${order.id}`,
      },
    });

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

    void sendPaidOrderAlert(order.id);
    await sendLowStockAlerts();

    return NextResponse.json({
      ...paymentResponse,
      orderId: order.id,
    });
  } catch (error: unknown) {
    console.error('Error procesando pago:', error);

    if (pendingOrderId && !paymentWasApproved) {
      const { accessToken } = mercadoPagoPaymentConfig();
      if (accessToken) {
        try {
          const approvedPayment = await findApprovedMercadoPagoPayment(accessToken, pendingOrderId);
          if (approvedPayment?.id != null) {
            const reconciled = await prisma.order.updateMany({
              where: { id: pendingOrderId, status: 'PENDING' },
              data: {
                status: 'PAID',
                paymentProvider: 'MERCADOPAGO',
                paymentExternalId: String(approvedPayment.id),
              },
            });

            if (reconciled.count === 1) {
              paymentWasApproved = true;
              void sendPaidOrderAlert(pendingOrderId);
              await sendLowStockAlerts();
              return NextResponse.json({
                id: approvedPayment.id,
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
