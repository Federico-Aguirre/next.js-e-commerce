import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { sendLowStockAlerts, sendPaidOrderAlert } from '@/lib/order-alerts';
import { sendOrderConfirmationEmail } from '@/lib/orders/order-confirmation-email';
import {
  mercadoPagoPaymentConfig,
  refreshPlatformSubscriptionPlan,
} from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

const ConfirmPaymentSchema = z
  .object({
    paymentId: z.union([
      z
        .string()
        .trim()
        .regex(/^\d{1,16}$/),
      z.number().int().positive().max(Number.MAX_SAFE_INTEGER).transform(String),
    ]),
  })
  .strict();

function privateNoStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return privateNoStoreJson(
      { message: 'Debés iniciar sesión para confirmar la orden.' },
      { status: 401 },
    );
  }

  const rateLimit = checkRateLimit('confirm-payment:' + hashRateLimitIdentity(user.id), {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return privateNoStoreJson(
      { message: 'Demasiadas verificaciones. Esperá un minuto y volvé a intentar.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  try {
    const parsed = ConfirmPaymentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return privateNoStoreJson(
        { message: 'Falta un identificador de pago válido.' },
        { status: 400 },
      );
    }

    const paymentId = parsed.data.paymentId;
    const { accessToken } = await mercadoPagoPaymentConfig();
    if (!accessToken) {
      return privateNoStoreJson({ message: 'Mercado Pago no está configurado.' }, { status: 503 });
    }

    // El navegador solo proporciona el ID. Estado, referencia, importe y moneda
    // se obtienen del servidor de Mercado Pago, nunca del body de la petición.
    const paymentClient = new Payment(new MercadoPagoConfig({ accessToken }));
    const payment = await paymentClient.get({ id: Number(paymentId) });

    if (payment.status !== 'approved' || payment.status_detail !== 'accredited') {
      return privateNoStoreJson(
        { message: 'Mercado Pago todavía no informa un pago acreditado.' },
        { status: 409 },
      );
    }

    const externalReference = payment.external_reference;
    if (!externalReference || typeof externalReference !== 'string') {
      return privateNoStoreJson(
        { message: 'El pago no contiene una referencia de compra válida.' },
        { status: 409 },
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        id: externalReference,
        userId: user.id,
        paymentProvider: 'MERCADOPAGO',
      },
      include: { items: true },
    });

    // Same generic response for a missing order and an order owned by someone else.
    if (!order) {
      return privateNoStoreJson(
        { message: 'No se encontró una compra pendiente asociada a este pago.' },
        { status: 404 },
      );
    }

    if (order.status === 'PAID' && order.paymentExternalId === String(paymentId)) {
      return privateNoStoreJson({
        success: true,
        orderId: order.id,
        paymentId: String(paymentId),
        status: 'PAID',
        alreadyConfirmed: true,
      });
    }

    if (
      order.status !== 'PENDING' ||
      order.expiresAt.getTime() <= Date.now() ||
      order.paymentTotal === null ||
      order.paymentCurrency !== payment.currency_id
    ) {
      return privateNoStoreJson(
        { message: 'La reserva venció o ya no coincide con el pago.' },
        { status: 409 },
      );
    }

    const actualAmount = Number(payment.transaction_amount);
    const expectedAmount = Number(order.paymentTotal.toFixed(2));
    if (!Number.isFinite(actualAmount) || Number(actualAmount.toFixed(2)) !== expectedAmount) {
      return privateNoStoreJson(
        { message: 'El importe acreditado no coincide con el de la reserva.' },
        { status: 409 },
      );
    }

    // Atomic compare-and-set: the same payment cannot confirm two requests.
    const updated = await prisma.order.updateMany({
      where: {
        id: order.id,
        userId: user.id,
        status: 'PENDING',
        paymentProvider: 'MERCADOPAGO',
        expiresAt: { gt: new Date() },
      },
      data: {
        status: 'PAID',
        paymentExternalId: String(paymentId),
      },
    });

    if (updated.count !== 1) {
      const current = await prisma.order.findFirst({
        where: { id: order.id, userId: user.id },
        select: { id: true, status: true, paymentExternalId: true },
      });
      if (current?.status === 'PAID' && current.paymentExternalId === String(paymentId)) {
        return privateNoStoreJson({
          success: true,
          orderId: current.id,
          paymentId: String(paymentId),
          status: 'PAID',
          alreadyConfirmed: true,
        });
      }

      return privateNoStoreJson(
        { message: 'La compra cambió de estado y no pudo confirmarse.' },
        { status: 409 },
      );
    }

    // Payment state is already committed. Refresh the recovery plan separately so
    // reaching the target returns subsequent orders to the standard 8% commission.
    await refreshPlatformSubscriptionPlan();

    // Notification failures must not cause the client to retry a charge confirmation as if the payment had failed.
    await Promise.allSettled([
      sendOrderConfirmationEmail(order.id),
      sendPaidOrderAlert(order.id),
      sendLowStockAlerts(),
    ]);

    return privateNoStoreJson({
      success: true,
      orderId: order.id,
      paymentId: String(paymentId),
      status: 'PAID',
      alreadyConfirmed: false,
    });
  } catch (error) {
    console.error(
      '[confirm-payment] failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return privateNoStoreJson(
      { message: 'No se pudo verificar el pago en este momento.' },
      { status: 502 },
    );
  }
}
