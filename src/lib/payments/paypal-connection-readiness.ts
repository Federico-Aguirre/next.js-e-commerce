export type PayPalConnectionState = {
  status: string;
  externalAccountId: string | null;
  metadata: unknown;
} | null;

/**
 * PayPal's live status endpoint can fail transiently. Only trust a REQUIRES_ACTION
 * record when its stored metadata proves that this seller previously passed the
 * sandbox onboarding checks; otherwise keep the connection disabled.
 */
export function hasVerifiedPayPalConnection(connection: PayPalConnectionState): boolean {
  if (!connection?.externalAccountId) return false;

  const value = connection.metadata;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  if (metadata.sandbox !== true) return false;

  // Active links are trusted only when they belong to the sandbox environment.
  if (connection.status === 'ACTIVE' || connection.status === 'CONNECTED') return true;
  if (connection.status !== 'REQUIRES_ACTION') return false;

  const verification = metadata.verification;
  if (
    verification !== 'paypal_tracking_api' &&
    verification !== 'paypal_api' &&
    verification !== 'paypal_sandbox_return'
  ) {
    return false;
  }

  const emailConfirmed = metadata.primaryEmailConfirmed === true;
  const thirdPartyConsent =
    metadata.thirdPartyConsent === true ||
    (metadata.permissionsGranted === true && metadata.consentStatus === true);
  const sellerCanReceivePayments =
    metadata.paymentsReceivable === true ||
    (metadata.permissionsGranted === true && metadata.businessAccount === true);

  return emailConfirmed && thirdPartyConsent && sellerCanReceivePayments;
}
