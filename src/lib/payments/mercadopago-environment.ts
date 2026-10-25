export type MercadoPagoEnvironment = 'sandbox' | 'production' | 'invalid';

export type MercadoPagoCredentialResolution = {
  accessToken: string | undefined;
  chargeEnabled: boolean;
  splitEnabled: boolean;
  standaloneEnabled: boolean;
  sandbox: boolean;
};

/**
 * Missing mode keeps development safe by default. Production remains blocked
 * until the live OAuth marketplace flow is explicitly implemented and verified.
 */
export function resolveMercadoPagoEnvironment(value: string | undefined): MercadoPagoEnvironment {
  const normalized = value?.trim().toLowerCase();

  if (!normalized || normalized === 'sandbox') return 'sandbox';
  if (normalized === 'production') return 'production';
  return 'invalid';
}

/** A stored OAuth token may be used for sandbox only when its DB metadata says so. */
export function isMercadoPagoSandboxOAuthMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;

  const values = metadata as Record<string, unknown>;
  return values.sandbox === true && values.liveMode !== true;
}

/**
 * Resolve only explicitly sandbox-scoped credentials. Never silently fall back
 * to STORE_MERCADOPAGO_ACCESS_TOKEN, because that key has no reliable mode
 * indicator for every Mercado Pago product/API.
 */
export function resolveMercadoPagoSandboxCredentials(input: {
  environment: string | undefined;
  oauthAccessToken?: string | null;
  oauthMetadata?: unknown;
  sandboxStandaloneAccessToken?: string | null;
  developerClientId?: string | null;
  developerClientSecret?: string | null;
}): MercadoPagoCredentialResolution {
  const environment = resolveMercadoPagoEnvironment(input.environment);

  if (environment !== 'sandbox') {
    return {
      accessToken: undefined,
      chargeEnabled: false,
      splitEnabled: false,
      standaloneEnabled: false,
      sandbox: false,
    };
  }

  const candidateOAuthToken = input.oauthAccessToken?.trim();
  const oauthToken =
    candidateOAuthToken && isMercadoPagoSandboxOAuthMetadata(input.oauthMetadata)
      ? candidateOAuthToken
      : undefined;
  const standaloneToken = input.sandboxStandaloneAccessToken?.trim() || undefined;

  const splitEnabled = Boolean(
    oauthToken && input.developerClientId?.trim() && input.developerClientSecret?.trim(),
  );
  const standaloneEnabled = Boolean(!oauthToken && standaloneToken);
  const chargeEnabled = splitEnabled || standaloneEnabled;

  return {
    accessToken: chargeEnabled ? oauthToken || standaloneToken : undefined,
    chargeEnabled,
    splitEnabled,
    standaloneEnabled,
    sandbox: true,
  };
}
