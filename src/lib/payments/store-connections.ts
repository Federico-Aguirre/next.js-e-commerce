import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptPaymentSecret, encryptPaymentSecret } from './secret-store';

export type PaymentProvider = 'MERCADOPAGO' | 'PAYPAL' | 'STRIPE';

export async function getStorePaymentConnection(provider: PaymentProvider) {
  const row = await prisma.storePaymentConnection.findUnique({ where: { provider } });
  if (!row) return null;
  return {
    ...row,
    accessToken: decryptPaymentSecret(row.accessTokenEncrypted),
    refreshToken: decryptPaymentSecret(row.refreshTokenEncrypted),
  };
}

export async function saveStorePaymentConnection(input: {
  provider: PaymentProvider;
  externalAccountId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  status?: string;
  metadata?: Prisma.InputJsonObject;
}) {
  return prisma.storePaymentConnection.upsert({
    where: { provider: input.provider },
    create: {
      provider: input.provider,
      externalAccountId: input.externalAccountId ?? null,
      accessTokenEncrypted: input.accessToken ? encryptPaymentSecret(input.accessToken) : null,
      refreshTokenEncrypted: input.refreshToken ? encryptPaymentSecret(input.refreshToken) : null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      status: input.status ?? 'CONNECTED',
      metadata: input.metadata ?? undefined,
    },
    update: {
      externalAccountId: input.externalAccountId ?? undefined,
      accessTokenEncrypted:
        input.accessToken === undefined
          ? undefined
          : input.accessToken
            ? encryptPaymentSecret(input.accessToken)
            : null,
      refreshTokenEncrypted:
        input.refreshToken === undefined
          ? undefined
          : input.refreshToken
            ? encryptPaymentSecret(input.refreshToken)
            : null,
      tokenExpiresAt: input.tokenExpiresAt ?? undefined,
      status: input.status ?? 'CONNECTED',
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function paymentConnectionStatuses() {
  const rows = await prisma.storePaymentConnection.findMany({
    select: { provider: true, externalAccountId: true, status: true, updatedAt: true },
  });
  return Object.fromEntries(rows.map((row) => [row.provider, row]));
}
