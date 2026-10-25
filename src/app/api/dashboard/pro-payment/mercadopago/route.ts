import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireDashboardAdmin } from '@/app/[locale]/dashboard/data';
import { getDeveloperMercadoPagoSandboxContext } from '@/lib/payments/developer-mercadopago-sandbox';
import { getMercadoPagoSandboxCustomerEmail } from '@/lib/payments/mercadopago-saved-cards';
import {
  assertProPlanCanBePurchased,
  completeRegisteredProPayment,
  failRegisteredProPayment,
  findProPaymentAttempt,
  ProPlanBillingError,
  registerPendingProPayment,
} from '@/lib/payments/pro-plan-billing';
import { prisma } from '@/lib/prisma';

const PRICE_ARS = 75000;
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const RequestSchema = z
  .object({
    action: z.literal('charge'),
    paymentAttemptId: z.string().uuid(),
    token: z.string().trim().min(1).max(8192),
    paymentMethodId: z.string().trim().min(1).max(64),
    savedPaymentMethodId: z.string().trim().min(1).max(191).optional(),
    email: z.string().trim().email().max(254).optional(),
    docType: z.string().trim().max(16).optional(),
    docNumber: z.string().trim().min(5).max(20).optional(),
  })
  .strict();

function responseError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

async function getBillingContext() {
  const context = await getDeveloperMercadoPagoSandboxContext();
  return context ? { accessToken: context.accessToken, scope: context.accountScope } : null;
}

async function getPayment(accessToken: string, paymentId: string) {
  const response = await fetch(
    'https://api.mercadopago.com/v1/payments/' + encodeURIComponent(paymentId),
    {
      headers: { Authorization: 'Bearer ' + accessToken },
      cache: 'no-store',
    },
  );
  return {
    status: response.status,
    data: (await response.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

export async function POST(request: Request) {
  try {
    const admin = await requireDashboardAdmin();
    const adminUserId = admin.user.id;
    if (!adminUserId) return responseError('ADMIN_ID_MISSING', 401);
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) return responseError('INVALID_REQUEST', 400);
    const input = parsed.data;
    const context = await getBillingContext();
    if (!context) return responseError('MERCADOPAGO_SANDBOX_CREDENTIALS_UNAVAILABLE', 503);

    const externalReference = 'pro-plan-' + adminUserId + '-' + input.paymentAttemptId;
    const previous = await findProPaymentAttempt(input.paymentAttemptId);
    if (previous) {
      if (previous.adminUserId !== adminUserId || previous.paymentProvider !== 'MERCADOPAGO') {
        return responseError('PAYMENT_ATTEMPT_OWNER_MISMATCH', 403);
      }
      if (previous.status === 'PAID') {
        const completed = await completeRegisteredProPayment({
          adminUserId,
          provider: 'MERCADOPAGO',
          paymentAttemptId: input.paymentAttemptId,
          providerTransactionId: previous.providerTransactionId,
        });
        return completed.activated
          ? NextResponse.json(
              { success: true, activated: true, alreadyProcessed: true },
              { headers: NO_STORE },
            )
          : responseError('PAYMENT_ALREADY_RECORDED_CHECK_PLAN', 409);
      }
      if (previous.status !== 'PENDING')
        return responseError('PAYMENT_ATTEMPT_ALREADY_FAILED', 409);
      if (!previous.providerTransactionId) {
        const search = await fetch(
          'https://api.mercadopago.com/v1/payments/search?external_reference=' +
            encodeURIComponent(externalReference) +
            '&sort=date_created&criteria=desc&limit=5',
          { headers: { Authorization: 'Bearer ' + context.accessToken }, cache: 'no-store' },
        );
        const found = (await search.json().catch(() => ({}))) as {
          results?: Array<{
            id?: number | string;
            status?: string;
            status_detail?: string;
            transaction_amount?: number;
            currency_id?: string;
            external_reference?: string;
          }>;
        };
        const match = search.ok
          ? found.results?.find(
              (item) => item.external_reference === externalReference && item.id != null,
            )
          : undefined;
        if (!match) return responseError('PRO_PAYMENT_PENDING', 409);
        await prisma.storeSubscriptionPayment.update({
          where: { paymentAttemptId: input.paymentAttemptId },
          data: { providerTransactionId: String(match.id) },
        });
        if (match.status === 'pending' || match.status === 'in_process') {
          return responseError('MERCADOPAGO_PAYMENT_PENDING', 409);
        }
        if (
          match.status !== 'approved' ||
          match.status_detail !== 'accredited' ||
          Math.abs(Number(match.transaction_amount) - PRICE_ARS) >= 0.01 ||
          match.currency_id !== 'ARS'
        ) {
          await failRegisteredProPayment({
            adminUserId,
            provider: 'MERCADOPAGO',
            paymentAttemptId: input.paymentAttemptId,
          });
          return responseError('MERCADOPAGO_PAYMENT_NOT_APPROVED', 409);
        }
        const settled = await completeRegisteredProPayment({
          adminUserId,
          provider: 'MERCADOPAGO',
          paymentAttemptId: input.paymentAttemptId,
          providerTransactionId: String(match.id),
        });
        return settled.activated
          ? NextResponse.json(
              { success: true, activated: true, paidThrough: settled.paidThrough.toISOString() },
              { headers: NO_STORE },
            )
          : responseError('PAYMENT_RECORDED_STOREFRONT_CLOSED', 409);
      }
      const remote = await getPayment(context.accessToken, previous.providerTransactionId);
      const payment = remote.data;
      if (remote.status < 200 || remote.status >= 300)
        return responseError('MERCADOPAGO_PAYMENT_STATUS_UNAVAILABLE', 502);
      if (payment.status === 'pending' || payment.status === 'in_process')
        return responseError('MERCADOPAGO_PAYMENT_PENDING', 409);
      if (
        payment.status !== 'approved' ||
        payment.status_detail !== 'accredited' ||
        Math.abs(Number(payment.transaction_amount) - PRICE_ARS) >= 0.01 ||
        payment.currency_id !== 'ARS' ||
        payment.external_reference !== externalReference
      ) {
        await failRegisteredProPayment({
          adminUserId,
          provider: 'MERCADOPAGO',
          paymentAttemptId: input.paymentAttemptId,
        });
        return responseError('MERCADOPAGO_PAYMENT_NOT_APPROVED', 409);
      }
      const completed = await completeRegisteredProPayment({
        adminUserId,
        provider: 'MERCADOPAGO',
        paymentAttemptId: input.paymentAttemptId,
        providerTransactionId: String(payment.id),
      });
      return NextResponse.json(
        {
          success: true,
          activated: completed.activated,
          paidThrough: completed.paidThrough.toISOString(),
        },
        { headers: NO_STORE },
      );
    }

    await assertProPlanCanBePurchased();
    let payerEmail =
      input.email || admin.user.email || getMercadoPagoSandboxCustomerEmail(adminUserId);
    let savedPaymentCustomerId: string | undefined;
    if (input.savedPaymentMethodId) {
      const saved = await prisma.savedPaymentMethod.findFirst({
        where: {
          id: input.savedPaymentMethodId,
          paymentCustomer: {
            userId: adminUserId,
            provider: 'MERCADOPAGO',
            accountScope: context.scope,
          },
        },
        include: { paymentCustomer: true },
      });
      if (!saved) return responseError('SAVED_CARD_NOT_FOUND', 404);
      if (saved.paymentMethodId !== input.paymentMethodId)
        return responseError('PAYMENT_METHOD_MISMATCH', 409);
      savedPaymentCustomerId = saved.paymentCustomer.externalCustomerId;
      const customer = await fetch(
        'https://api.mercadopago.com/v1/customers/' +
          encodeURIComponent(saved.paymentCustomer.externalCustomerId),
        { headers: { Authorization: 'Bearer ' + context.accessToken }, cache: 'no-store' },
      );
      const customerData = (await customer.json().catch(() => ({}))) as { email?: string };
      if (customer.ok && customerData.email) payerEmail = customerData.email;
    }

    await registerPendingProPayment({
      adminUserId,
      provider: 'MERCADOPAGO',
      externalPaymentId: externalReference,
      paymentAttemptId: input.paymentAttemptId,
      paymentAmount: PRICE_ARS,
      paymentCurrency: 'ARS',
      exchangeRate: 1,
      expiresAt: new Date(Date.now() + 180000),
      savedPaymentMethodId: input.savedPaymentMethodId ?? null,
    });

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + context.accessToken,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.paymentAttemptId,
      },
      body: JSON.stringify({
        transaction_amount: PRICE_ARS,
        token: input.token,
        description: 'Abono mensual del plan Pro Nova Store',
        installments: 1,
        payment_method_id: input.paymentMethodId,
        external_reference: externalReference,
        statement_descriptor: 'NOVA STORE',
        payer: savedPaymentCustomerId
          ? {
              type: 'customer',
              id: savedPaymentCustomerId,
              ...(input.docType && input.docNumber
                ? { identification: { type: input.docType, number: input.docNumber } }
                : {}),
            }
          : {
              email: payerEmail,
              ...(input.docType && input.docNumber
                ? { identification: { type: input.docType, number: input.docNumber } }
                : {}),
            },
      }),
      cache: 'no-store',
    });
    const payment = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.status < 200 || response.status >= 300 || payment.id == null) {
      await failRegisteredProPayment({
        adminUserId,
        provider: 'MERCADOPAGO',
        paymentAttemptId: input.paymentAttemptId,
      });
      return responseError('MERCADOPAGO_PAYMENT_NOT_APPROVED', 409);
    }

    await prisma.storeSubscriptionPayment.update({
      where: { paymentAttemptId: input.paymentAttemptId },
      data: { providerTransactionId: String(payment.id) },
    });
    if (payment.status === 'pending' || payment.status === 'in_process') {
      return responseError('MERCADOPAGO_PAYMENT_PENDING', 409);
    }
    if (
      payment.status !== 'approved' ||
      payment.status_detail !== 'accredited' ||
      Math.abs(Number(payment.transaction_amount) - PRICE_ARS) >= 0.01 ||
      payment.currency_id !== 'ARS' ||
      payment.external_reference !== externalReference
    ) {
      await failRegisteredProPayment({
        adminUserId,
        provider: 'MERCADOPAGO',
        paymentAttemptId: input.paymentAttemptId,
      });
      return responseError('MERCADOPAGO_PAYMENT_NOT_APPROVED', 409);
    }

    const completed = await completeRegisteredProPayment({
      adminUserId,
      provider: 'MERCADOPAGO',
      paymentAttemptId: input.paymentAttemptId,
      providerTransactionId: String(payment.id),
    });
    if (!completed.activated && completed.storefrontClosed)
      return responseError('PAYMENT_RECORDED_STOREFRONT_CLOSED', 409);
    return NextResponse.json(
      {
        success: true,
        activated: completed.activated,
        paidThrough: completed.paidThrough.toISOString(),
        amountARS: PRICE_ARS,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof ProPlanBillingError) {
      const status = ['STOREFRONT_CLOSED', 'PRO_ALREADY_ACTIVE', 'PRO_PAYMENT_PENDING'].includes(
        error.code,
      )
        ? 409
        : 400;
      return responseError(error.code, status);
    }
    console.error(
      '[pro-payment-mercadopago] failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return responseError('MERCADOPAGO_PRO_PAYMENT_FAILED', 502);
  }
}
