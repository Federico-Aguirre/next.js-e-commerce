import { MercadoPagoConfig, Payment } from 'mercadopago';
import { connection, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { mercadoPagoPaymentConfig } from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, hashRateLimitIdentity } from '@/lib/security/rate-limit';

const PaymentIdSchema = z
  .string()
  .trim()
  .regex(/^\d{1,16}$/);

export async function GET(request: Request) {
  await connection();

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Debés iniciar sesión para verificar el pago.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }

  const rateLimit = checkRateLimit('verify-payment:' + hashRateLimitIdentity(user.id), {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas verificaciones. Volvé a intentar en un minuto.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'Cache-Control': 'private, no-store, max-age=0',
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const parsedId = PaymentIdSchema.safeParse(searchParams.get('paymentId') || '');
  if (!parsedId.success) {
    return NextResponse.json(
      { error: 'paymentId inválido.' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }

  try {
    const { accessToken } = await mercadoPagoPaymentConfig();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado.' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    const payment = await new Payment(new MercadoPagoConfig({ accessToken })).get({
      id: Number(parsedId.data),
    });

    // This endpoint is only an informational check. It must never reveal the
    // state of an unrelated user's payment ID.
    const externalReference = payment.external_reference;
    if (!externalReference) {
      return NextResponse.json(
        { isApproved: false },
        { status: 200, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        id: externalReference,
        userId: user.id,
        paymentProvider: 'MERCADOPAGO',
      },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        paymentTotal: true,
        paymentCurrency: true,
        paymentExternalId: true,
      },
    });

    const paidAndMatched =
      !!order && order.status === 'PAID' && order.paymentExternalId === String(payment.id);
    const pendingAndValid =
      !!order &&
      order.status === 'PENDING' &&
      order.expiresAt.getTime() > Date.now() &&
      order.paymentTotal !== null &&
      Number(payment.transaction_amount).toFixed(2) === order.paymentTotal.toFixed(2) &&
      payment.currency_id === order.paymentCurrency;
    const isApproved =
      payment.status === 'approved' &&
      payment.status_detail === 'accredited' &&
      (paidAndMatched || pendingAndValid);

    return NextResponse.json(
      { isApproved },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[verify-payment] failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json(
      { isApproved: false },
      { status: 502, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }
}
