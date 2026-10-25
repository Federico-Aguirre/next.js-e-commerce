import { createHash } from 'node:crypto';

type MercadoPagoScopeInput = {
  accessToken: string;
  splitEnabled: boolean;
  externalAccountId?: string | null;
};

export function getMercadoPagoSavedCardScope({
  accessToken,
  splitEnabled,
  externalAccountId,
}: MercadoPagoScopeInput) {
  if (splitEnabled && externalAccountId?.trim()) {
    return `sandbox-split-${externalAccountId.trim()}`;
  }

  // Do not persist raw Access Tokens. A one-way digest isolates cards when the
  // connected sandbox account or standalone credentials change.
  const tokenFingerprint = createHash('sha256').update(accessToken).digest('hex').slice(0, 24);
  return `sandbox-token-${tokenFingerprint}`;
}

export function getMercadoPagoSandboxCustomerEmail(userId: string) {
  // Mercado Pago requires this email format for customer objects in sandbox.
  const digest = createHash('sha256').update(userId).digest();
  const suffix = (digest.readUInt32BE(0) % 9_999_999_999) + 1;
  return `test_payer_${suffix}@testuser.com`;
}

export function getSavedCardBrandLabel(name?: string | null, id?: string | null) {
  const raw = (name || id || 'Tarjeta').trim();
  if (!raw) return 'Tarjeta';
  return raw.slice(0, 1).toLocaleUpperCase('es-AR') + raw.slice(1).replace(/_/g, ' ');
}
