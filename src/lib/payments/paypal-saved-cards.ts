import 'server-only';
import { createHash } from 'node:crypto';
import { paypalAuthAssertion } from '@/lib/payments/platform-config';
import { prisma } from '@/lib/prisma';

type PayPalVaultConfig = {
  clientId?: string;
  clientSecret?: string;
  sellerMerchantId?: string;
  partnerAttributionId?: string;
  splitEnabled?: boolean;
  sandbox?: boolean;
};

export function getPayPalSavedCardScope(sellerMerchantId: string) {
  const fingerprint = createHash('sha256').update(sellerMerchantId).digest('hex').slice(0, 24);
  return `sandbox-seller-${fingerprint}`;
}

export function getPayPalCardBrandLabel(brand?: string | null) {
  const raw = (brand || 'Tarjeta').trim();
  if (!raw) return 'Tarjeta';
  return raw.slice(0, 1).toLocaleUpperCase('es-AR') + raw.slice(1).toLocaleLowerCase('es-AR');
}

/** Create the safe Orders API card source for one of the three explicit checkout choices. */
export function buildPayPalOrderCardSource(input: {
  savedPaymentMethodId?: string | null;
  savePaymentMethod: boolean;
  existingCustomerId?: string | null;
}) {
  if (input.savedPaymentMethodId) {
    return { card: { vault_id: input.savedPaymentMethodId } };
  }
  if (!input.savePaymentMethod) return undefined;

  return {
    card: {
      attributes: {
        vault: {
          store_in_vault: 'ON_SUCCESS' as const,
          usage_type: 'PLATFORM' as const,
          customer_type: 'CONSUMER' as const,
          permit_multiple_payment_tokens: true,
        },
        ...(input.existingCustomerId ? { customer: { id: input.existingCustomerId } } : {}),
      },
    },
  };
}

export async function getPayPalSandboxAccessToken(config: PayPalVaultConfig) {
  if (
    config.sandbox !== true ||
    !config.splitEnabled ||
    !config.clientId ||
    !config.clientSecret ||
    !config.sellerMerchantId
  ) {
    throw new Error('PayPal Vault requiere una cuenta Connect sandbox activa.');
  }

  const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(config.partnerAttributionId
        ? { 'PayPal-Partner-Attribution-Id': config.partnerAttributionId }
        : {}),
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(`PayPal sandbox authentication failed (HTTP ${response.status}).`);
  }

  return data.access_token;
}

export function getPayPalVaultHeaders(config: PayPalVaultConfig, accessToken: string) {
  if (!config.clientId || !config.sellerMerchantId) {
    throw new Error('PayPal Connect sandbox configuration is incomplete.');
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...(config.partnerAttributionId
      ? { 'PayPal-Partner-Attribution-Id': config.partnerAttributionId }
      : {}),
    'PayPal-Auth-Assertion': paypalAuthAssertion(config.clientId, config.sellerMerchantId),
  };
}

type PayPalCardMetadata = {
  id: string;
  customerId: string;
  brand?: string | null;
  lastDigits?: string | null;
  expiry?: string | null;
};

export async function persistPayPalVaultCustomer(input: {
  userId: string;
  sellerMerchantId: string;
  customerId: string;
}) {
  const externalCustomerId = input.customerId.trim();
  if (!externalCustomerId) throw new Error('PayPal did not return a valid vault customer ID.');

  const accountScope = getPayPalSavedCardScope(input.sellerMerchantId);
  const alreadyAssigned = await prisma.paymentCustomer.findUnique({
    where: {
      provider_accountScope_externalCustomerId: {
        provider: 'PAYPAL',
        accountScope,
        externalCustomerId,
      },
    },
  });
  if (alreadyAssigned && alreadyAssigned.userId !== input.userId) {
    throw new Error('The PayPal Vault customer is already assigned to another local user.');
  }

  const where = {
    userId_provider_accountScope: {
      userId: input.userId,
      provider: 'PAYPAL',
      accountScope,
    },
  };
  const previous = await prisma.paymentCustomer.findUnique({ where });
  if (previous && previous.externalCustomerId !== externalCustomerId) {
    await prisma.savedPaymentMethod.deleteMany({ where: { paymentCustomerId: previous.id } });
  }

  return prisma.paymentCustomer.upsert({
    where,
    create: {
      userId: input.userId,
      provider: 'PAYPAL',
      accountScope,
      externalCustomerId,
    },
    update: { externalCustomerId },
  });
}

export async function persistPayPalVaultCard(input: {
  userId: string;
  sellerMerchantId: string;
  card: PayPalCardMetadata;
}) {
  const externalCardId = input.card.id.trim();
  const externalCustomerId = input.card.customerId.trim();
  if (!externalCardId || !externalCustomerId) {
    throw new Error('PayPal did not return a valid vault token/customer pair.');
  }

  const customer = await persistPayPalVaultCustomer({
    userId: input.userId,
    sellerMerchantId: input.sellerMerchantId,
    customerId: externalCustomerId,
  });

  const [yearText, monthText] = (input.card.expiry || '').split('-');
  const month = Number(monthText);
  const year = Number(yearText);
  const lastDigits = /^\d{4}$/.test(input.card.lastDigits || '') ? input.card.lastDigits! : null;

  return prisma.savedPaymentMethod.upsert({
    where: {
      paymentCustomerId_externalCardId: {
        paymentCustomerId: customer.id,
        externalCardId,
      },
    },
    create: {
      paymentCustomerId: customer.id,
      externalCardId,
      paymentMethodId: 'card',
      paymentType: 'card',
      paymentMethodName: input.card.brand || 'Tarjeta',
      lastFourDigits: lastDigits,
      expirationMonth: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
      expirationYear: Number.isInteger(year) && year >= 2000 ? year : null,
    },
    update: {
      paymentMethodId: 'card',
      paymentType: 'card',
      paymentMethodName: input.card.brand || 'Tarjeta',
      lastFourDigits: lastDigits,
      expirationMonth: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
      expirationYear: Number.isInteger(year) && year >= 2000 ? year : null,
    },
  });
}

export async function getLocalPayPalSavedCards(userId: string, accountScope: string) {
  const customer = await prisma.paymentCustomer.findUnique({
    where: {
      userId_provider_accountScope: {
        userId,
        provider: 'PAYPAL',
        accountScope,
      },
    },
    include: { cards: { orderBy: { createdAt: 'desc' } } },
  });

  if (!customer) return { customer: null, cards: [] };
  return {
    customer,
    cards: customer.cards.map((card) => ({
      id: card.id,
      brand: getPayPalCardBrandLabel(card.paymentMethodName),
      lastFourDigits: card.lastFourDigits,
      expirationMonth: card.expirationMonth,
      expirationYear: card.expirationYear,
    })),
  };
}
