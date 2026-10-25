import 'server-only';
import type { Prisma, StoreSubscription } from '@prisma/client';
import Stripe from 'stripe';
import { roundCurrencyAmount } from '@/lib/currency/currencies';
import { prisma } from '@/lib/prisma';
import { StoreConfig } from '@/utils/StoreConfig';
import {
  isMercadoPagoSandboxOAuthMetadata,
  resolveMercadoPagoEnvironment,
  resolveMercadoPagoSandboxCredentials,
} from './mercadopago-environment';
import { hasVerifiedPayPalConnection } from './paypal-connection-readiness';
import {
  calculatePlatformFeeForPlan,
  commissionForPlan,
  CUSTOMIZATION_RECOVERY_PLAN,
  DEFAULT_PRO_MONTHLY_PRICE_ARS,
  DEFAULT_RECOVERY_TARGET_ARS,
  normalizePlanType,
  PRO_PLAN,
  STANDARD_COMMISSION_PERCENT,
  STANDARD_PLAN,
} from './plan-pricing';
import { getStorePaymentConnection, saveStorePaymentConnection } from './store-connections';

type PlanDb = Pick<Prisma.TransactionClient, 'storeSubscription' | 'order'>;
type PlanState = {
  subscription: StoreSubscription;
  /** Plan selected by the administrator, even if its paid period has expired. */
  planType: import('./plan-pricing').PlatformBasePlanType;
  /** Plan whose commission applies to the next order; expired Pro falls back to Standard. */
  feePlanType: import('./plan-pricing').PlatformBasePlanType;
  customizationRecoveryActive: boolean;
  proActive: boolean;
  recoveredAmount: number;
  reservedAmount: number;
};

export type PlatformSubscriptionSummary = {
  status: string;
  storefrontStatus: 'OPEN' | 'CLOSING' | 'CLOSED';
  storefrontClosedAt: Date | null;
  planType: import('./plan-pricing').PlatformBasePlanType;
  commissionPercent: number;
  baseCommissionPercent: number;
  proActive: boolean;
  customizationRecoveryActive: boolean;
  setupRecoveryTarget: number;
  setupRecoveryStartedAt: Date | null;
  monthlyPriceARS: number;
  nextPaymentAt: Date | null;
  recoveredAmount: number;
  reservedAmount: number;
  recoveryRemaining: number;
};

async function ensureStoreSubscription(db: PlanDb) {
  return db.storeSubscription.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      status: 'ACTIVE',
      planType: STANDARD_PLAN,
      commissionPercent: STANDARD_COMMISSION_PERCENT,
      setupRecoveryTarget: DEFAULT_RECOVERY_TARGET_ARS,
      customizationRecoveryActive: false,
      monthlyPriceARS: DEFAULT_PRO_MONTHLY_PRICE_ARS,
    },
    update: {},
  });
}

async function readPlanState(
  db: PlanDb,
  options: { excludeOrderId?: string } = {},
): Promise<PlanState> {
  let subscription = await ensureStoreSubscription(db);
  const legacyRecoveryPlan = subscription.planType === CUSTOMIZATION_RECOVERY_PLAN;
  const planType = normalizePlanType(subscription.planType);
  const now = new Date();
  const proActive =
    planType === PRO_PLAN &&
    Boolean(subscription.nextPaymentAt && subscription.nextPaymentAt.getTime() > now.getTime());
  const feePlanType = proActive ? PRO_PLAN : STANDARD_PLAN;
  const expectedPercent = commissionForPlan(feePlanType);
  const customizationRecoveryActive =
    subscription.customizationRecoveryActive || legacyRecoveryPlan;
  // Preserve a partially paid recovery cycle when the administrator changes plans.
  // A timestamp is created only when recovery is explicitly activated and never replaced
  // by a normal Standard/Pro plan change.
  const recoveryStartedAt =
    customizationRecoveryActive && !subscription.setupRecoveryStartedAt
      ? new Date()
      : subscription.setupRecoveryStartedAt;

  if (
    subscription.planType !== planType ||
    subscription.commissionPercent !== expectedPercent ||
    subscription.customizationRecoveryActive !== customizationRecoveryActive ||
    recoveryStartedAt !== subscription.setupRecoveryStartedAt
  ) {
    subscription = await db.storeSubscription.update({
      where: { id: 'default' },
      data: {
        planType,
        commissionPercent: expectedPercent,
        customizationRecoveryActive,
        setupRecoveryStartedAt: recoveryStartedAt,
      },
    });
  }

  const periodStart = subscription.setupRecoveryStartedAt ?? subscription.createdAt;
  const pendingOrderFilter = {
    ...(options.excludeOrderId ? { id: { not: options.excludeOrderId } } : {}),
    status: { in: ['PENDING', 'PAYMENT_PROCESSING'] },
    expiresAt: { gt: now },
    platformRecoveryCycleStartedAt: periodStart,
    platformRecoveryAmount: { gt: 0 },
  };
  const [paidRecovery, pendingRecovery] = await Promise.all([
    db.order.aggregate({
      where: {
        status: 'PAID',
        platformRecoveryCycleStartedAt: periodStart,
        platformRecoveryAmount: { gt: 0 },
      },
      _sum: { platformRecoveryAmount: true },
    }),
    customizationRecoveryActive
      ? db.order.aggregate({ where: pendingOrderFilter, _sum: { platformRecoveryAmount: true } })
      : Promise.resolve({ _sum: { platformRecoveryAmount: null } }),
  ]);

  const recoveredAmount = Math.max(0, paidRecovery._sum.platformRecoveryAmount ?? 0);
  const reservedAmount = Math.max(0, pendingRecovery._sum.platformRecoveryAmount ?? 0);

  // Only the surcharge is disabled when the recovery target is reached. The selected
  // base plan and its payment due date must survive this transition.
  if (customizationRecoveryActive && recoveredAmount >= subscription.setupRecoveryTarget - 0.01) {
    subscription = await db.storeSubscription.update({
      where: { id: 'default' },
      data: {
        customizationRecoveryActive: false,
        commissionPercent: expectedPercent,
      },
    });
    return {
      subscription,
      planType,
      feePlanType,
      customizationRecoveryActive: false,
      proActive,
      recoveredAmount,
      reservedAmount,
    };
  }

  return {
    subscription,
    planType,
    feePlanType,
    customizationRecoveryActive,
    proActive,
    recoveredAmount,
    reservedAmount,
  };
}

export async function getPlatformSubscriptionSummary(): Promise<PlatformSubscriptionSummary> {
  const state = await readPlanState(prisma);
  const target = state.subscription.setupRecoveryTarget;
  const baseCommissionPercent = commissionForPlan(state.feePlanType);
  const commissionPercent = baseCommissionPercent + (state.customizationRecoveryActive ? 7 : 0);
  return {
    status: state.subscription.status,
    storefrontStatus: state.subscription.storefrontStatus as 'OPEN' | 'CLOSING' | 'CLOSED',
    storefrontClosedAt: state.subscription.storefrontClosedAt,
    planType: state.planType,
    commissionPercent,
    baseCommissionPercent,
    proActive: state.proActive,
    customizationRecoveryActive: state.customizationRecoveryActive,
    setupRecoveryTarget: target,
    setupRecoveryStartedAt: state.subscription.setupRecoveryStartedAt,
    monthlyPriceARS: state.subscription.monthlyPriceARS,
    nextPaymentAt: state.subscription.nextPaymentAt,
    recoveredAmount: Math.min(target, state.recoveredAmount),
    reservedAmount: Math.min(Math.max(0, target - state.recoveredAmount), state.reservedAmount),
    recoveryRemaining: Math.max(0, target - state.recoveredAmount - state.reservedAmount),
  };
}

export async function platformCommissionPercent() {
  return (await getPlatformSubscriptionSummary()).commissionPercent;
}

/** Refreshes the recovery target after a successful payment without ever failing that payment. */
export async function refreshPlatformSubscriptionPlan() {
  try {
    await getPlatformSubscriptionSummary();
  } catch (error) {
    console.error('No se pudo actualizar el plan de la plataforma tras el pago.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}

export function commissionableProductSubtotal(items: Array<{ price: number; quantity: number }>) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  return roundCurrencyAmount(subtotal, StoreConfig.currency);
}

function calculatePlatformFee(subtotal: number, state: PlanState) {
  return calculatePlatformFeeForPlan({
    subtotal,
    planType: state.feePlanType,
    customizationRecoveryActive: state.customizationRecoveryActive,
    setupRecoveryTarget: state.subscription.setupRecoveryTarget,
    recoveredAmount: state.recoveredAmount,
    reservedAmount: state.reservedAmount,
  });
}

export async function platformFee(amount: number) {
  const state = await readPlanState(prisma);
  return calculatePlatformFee(roundCurrencyAmount(amount, StoreConfig.currency), state).feeAmount;
}

export async function platformFeeForProducts(
  items: Array<{ price: number; quantity: number }>,
  orderId?: string,
) {
  const subtotal = commissionableProductSubtotal(items);

  if (!orderId) {
    const state = await readPlanState(prisma);
    return calculatePlatformFee(subtotal, state).feeAmount;
  }

  return prisma.$transaction(
    async (tx) => {
      await ensureStoreSubscription(tx);
      await tx.storeSubscription.update({
        where: { id: 'default' },
        data: { updatedAt: new Date() },
      });

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          platformFeeAmount: true,
        },
      });
      if (!order)
        throw new Error('No se encontró el pedido para calcular la comisión de plataforma.');
      if (
        !['PENDING', 'PAYMENT_PROCESSING'].includes(order.status) ||
        order.expiresAt <= new Date()
      ) {
        throw new Error('El pedido venció o dejó de estar disponible para calcular su comisión.');
      }
      if (order.platformFeeAmount !== null) return order.platformFeeAmount;

      const state = await readPlanState(tx, { excludeOrderId: orderId });
      const calculated = calculatePlatformFee(subtotal, state);
      await tx.order.update({
        where: { id: orderId },
        data: {
          platformCommissionPercent: calculated.commissionPercent,
          platformFeeAmount: calculated.feeAmount,
          platformRecoveryAmount: calculated.recoveryAmount,
          platformRecoveryCycleStartedAt:
            calculated.recoveryAmount > 0 ? state.subscription.setupRecoveryStartedAt : null,
        },
      });
      return calculated.feeAmount;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

function connectionCanCharge(status: string | null | undefined) {
  return !status || status === 'CONNECTED' || status === 'ACTIVE';
}

async function refreshMercadoPagoTokenIfNeeded() {
  // This integration is intentionally sandbox-only until live marketplace OAuth
  // and commission splitting have been implemented and explicitly validated.
  if (resolveMercadoPagoEnvironment(process.env.MERCADOPAGO_ENVIRONMENT) !== 'sandbox') {
    return null;
  }

  const connection = await getStorePaymentConnection('MERCADOPAGO');
  if (
    !connection?.accessToken ||
    !connectionCanCharge(connection.status) ||
    !isMercadoPagoSandboxOAuthMetadata(connection.metadata)
  ) {
    return connection;
  }

  const expiresSoon =
    connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() <= Date.now() + 5 * 60 * 1000;
  if (!expiresSoon || !connection.refreshToken) return connection;

  const clientId = process.env.DEVELOPER_MERCADOPAGO_CLIENT_ID?.trim();
  const clientSecret = process.env.DEVELOPER_MERCADOPAGO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return connection;

  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    }),
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error('No se pudo renovar el token OAuth de Mercado Pago.', data);
    await saveStorePaymentConnection({ provider: 'MERCADOPAGO', status: 'REQUIRES_ACTION' });
    return getStorePaymentConnection('MERCADOPAGO');
  }

  await saveStorePaymentConnection({
    provider: 'MERCADOPAGO',
    externalAccountId: String(data.user_id ?? connection.externalAccountId ?? ''),
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : connection.refreshToken,
    tokenExpiresAt: data.expires_in
      ? new Date(Date.now() + Number(data.expires_in) * 1000)
      : connection.tokenExpiresAt,
    status: 'CONNECTED',
    metadata: {
      sandbox: true,
      publicKey: data.public_key ?? null,
      scope: data.scope ?? null,
      liveMode: data.live_mode ?? false,
    },
  });

  return getStorePaymentConnection('MERCADOPAGO');
}

export async function mercadoPagoPaymentConfig() {
  // In development, default to sandbox. In production, require an explicit
  // environment so a missing variable cannot silently permit sandbox charges.
  const configuredEnvironment =
    process.env.MERCADOPAGO_ENVIRONMENT?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'invalid' : 'sandbox');
  const environment = resolveMercadoPagoEnvironment(configuredEnvironment);

  // Fail closed in production/unknown modes until live marketplace OAuth and
  // the 90/10 split are separately implemented and validated end to end.
  if (environment !== 'sandbox') {
    return {
      accessToken: undefined,
      chargeEnabled: false,
      splitEnabled: false,
      standaloneEnabled: false,
      externalAccountId: undefined,
      sandbox: false,
    };
  }

  const connection = await refreshMercadoPagoTokenIfNeeded();
  const storedOauthToken =
    connectionCanCharge(connection?.status) &&
    isMercadoPagoSandboxOAuthMetadata(connection?.metadata)
      ? connection?.accessToken
      : undefined;

  // Never silently fall back to the generic STORE_MERCADOPAGO_ACCESS_TOKEN:
  // configure an explicit sandbox-only token if a standalone sandbox flow is needed.
  const resolved = resolveMercadoPagoSandboxCredentials({
    environment: configuredEnvironment,
    oauthAccessToken: storedOauthToken,
    oauthMetadata: connection?.metadata,
    sandboxStandaloneAccessToken: process.env.STORE_MERCADOPAGO_SANDBOX_ACCESS_TOKEN,
    developerClientId: process.env.DEVELOPER_MERCADOPAGO_CLIENT_ID,
    developerClientSecret: process.env.DEVELOPER_MERCADOPAGO_CLIENT_SECRET,
  });

  return {
    ...resolved,
    externalAccountId: connection?.externalAccountId,
  };
}

export async function stripePaymentConfig() {
  const connection = await getStorePaymentConnection('STRIPE');
  const platformSecretKey = process.env.DEVELOPER_STRIPE_SECRET_KEY?.trim();
  const connectedAccountId = connectionCanCharge(connection?.status)
    ? connection?.externalAccountId || process.env.STORE_STRIPE_CONNECTED_ACCOUNT_ID?.trim()
    : undefined;
  // Live Stripe Connect is not implemented yet. Require an explicit sandbox
  // mode and a test secret; a production build never accepts a test key by default.
  const stripeEnvironment =
    process.env.STRIPE_ENVIRONMENT?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'invalid' : 'sandbox');
  const sandboxKey = Boolean(
    stripeEnvironment === 'sandbox' && platformSecretKey?.startsWith('sk_test_'),
  );
  let accountReady = false;

  if (platformSecretKey && connectedAccountId && sandboxKey) {
    try {
      const stripe = new Stripe(platformSecretKey);
      const account = await stripe.v2.core.accounts.retrieve(connectedAccountId, {
        include: ['configuration.recipient'],
      });
      const transferStatus =
        account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
      accountReady = !account.livemode && !account.closed && transferStatus === 'active';
    } catch (error) {
      console.error('No se pudo validar la cuenta Connect de Stripe.', error);
    }
  }

  return {
    secretKey: sandboxKey ? platformSecretKey : undefined,
    connectedAccountId: accountReady ? connectedAccountId : undefined,
    splitEnabled: Boolean(platformSecretKey && connectedAccountId && sandboxKey && accountReady),
    sandbox: sandboxKey,
  };
}

/**
 * Runtime availability uses the effective server configuration and the result
 * of onboarding. Do not poll PayPal's merchant-status endpoint on every checkout:
 * transient API errors must not change an existing connection to REQUIRES_ACTION.
 */

export async function paypalPaymentConfig() {
  const connection = await getStorePaymentConnection('PAYPAL');
  const platformClientId = process.env.DEVELOPER_PAYPAL_CLIENT_ID?.trim();
  const platformClientSecret = process.env.DEVELOPER_PAYPAL_CLIENT_SECRET?.trim();
  const platformMerchantId = process.env.DEVELOPER_PAYPAL_MERCHANT_ID?.trim();
  const partnerAttributionId = process.env.DEVELOPER_PAYPAL_PARTNER_ATTRIBUTION_ID?.trim();
  const sellerMerchantId = hasVerifiedPayPalConnection(connection)
    ? connection?.externalAccountId || process.env.STORE_PAYPAL_MERCHANT_ID?.trim()
    : connectionCanCharge(connection?.status)
      ? process.env.STORE_PAYPAL_MERCHANT_ID?.trim()
      : undefined;
  // Live PayPal Partner payments are not enabled in this implementation.
  // Do not assume sandbox in production when the server-side mode is missing.
  const paypalEnvironment =
    process.env.PAYPAL_ENVIRONMENT?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'invalid' : 'sandbox');
  const sandboxEnabled =
    paypalEnvironment === 'sandbox' && process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT !== 'production';

  // "Connected" means the server has the expected sandbox credentials and a
  // seller account that completed onboarding. Live API rechecks are performed
  // during onboarding, not on every page load/payment-method availability request.
  const splitEnabled = Boolean(
    sandboxEnabled &&
    platformClientId &&
    platformClientSecret &&
    platformMerchantId &&
    partnerAttributionId &&
    sellerMerchantId,
  );

  return {
    clientId: sandboxEnabled ? platformClientId : undefined,
    clientSecret: sandboxEnabled ? platformClientSecret : undefined,
    sellerMerchantId: splitEnabled ? sellerMerchantId : undefined,
    partnerAttributionId: splitEnabled ? partnerAttributionId : undefined,
    splitEnabled,
    sandbox: sandboxEnabled,
  };
}

export function paypalAuthAssertion(clientId: string, sellerMerchantId: string) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/=+$/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  return `${encode({ alg: 'none' })}.${encode({ iss: clientId, payer_id: sellerMerchantId })}.`;
}
