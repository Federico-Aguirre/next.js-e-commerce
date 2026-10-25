import 'server-only';
import { createHash } from 'node:crypto';

const MP_OAUTH_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const TOKEN_REQUEST_TIMEOUT_MS = 8_000;

type OAuthTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

type CachedToken = {
  key: string;
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;
let pendingTokenRequest: { key: string; promise: Promise<CachedToken | null> } | null = null;

function getAccountScope(clientId: string) {
  // Do not scope saved cards to an access token: OAuth access tokens rotate.
  // The client ID identifies the platform application while keeping the ID private.
  const fingerprint = createHash('sha256')
    .update('nova-store-pro-plan-mercadopago-sandbox:' + clientId)
    .digest('hex')
    .slice(0, 24);
  return 'platform-pro-sandbox-' + fingerprint;
}

async function requestSandboxToken(
  clientId: string,
  clientSecret: string,
  key: string,
): Promise<CachedToken | null> {
  try {
    const response = await fetch(MP_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        test_token: true,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });
    const data = (await response.json().catch(() => ({}))) as OAuthTokenResponse;
    const accessToken = typeof data.access_token === 'string' ? data.access_token : '';
    const expiresIn =
      typeof data.expires_in === 'number' ? data.expires_in : Number(data.expires_in);

    // Never allow an OAuth fallback to silently turn this sandbox-only flow live.
    if (
      !response.ok ||
      !accessToken.startsWith('TEST-') ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 60
    ) {
      console.warn('[mercadopago-pro-sandbox] OAuth did not return a usable TEST token.', {
        status: response.status,
      });
      return null;
    }

    return {
      key,
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };
  } catch (error) {
    console.warn('[mercadopago-pro-sandbox] OAuth token request failed.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return null;
  }
}

async function getSandboxAccessToken(clientId: string, clientSecret: string) {
  const key = createHash('sha256')
    .update(clientId + '\u0000' + clientSecret)
    .digest('hex');

  if (cachedToken?.key === key && cachedToken.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
    return cachedToken.accessToken;
  }

  let promise: Promise<CachedToken | null>;
  if (pendingTokenRequest?.key === key) {
    promise = pendingTokenRequest.promise;
  } else {
    promise = requestSandboxToken(clientId, clientSecret, key);
    pendingTokenRequest = { key, promise };
  }

  try {
    const result = await promise;
    if (!result) return null;
    cachedToken = result;
    return result.accessToken;
  } finally {
    if (pendingTokenRequest?.promise === promise) pendingTokenRequest = null;
  }
}

export async function getDeveloperMercadoPagoSandboxContext(): Promise<{
  accessToken: string;
  publicKey: string;
  accountScope: string;
} | null> {
  const environment =
    process.env.MERCADOPAGO_ENVIRONMENT?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'invalid' : 'sandbox');
  const clientId = process.env.DEVELOPER_MERCADOPAGO_CLIENT_ID?.trim();
  const clientSecret = process.env.DEVELOPER_MERCADOPAGO_CLIENT_SECRET?.trim();
  const publicKey = process.env.NEXT_PUBLIC_DEVELOPER_MERCADOPAGO_PUBLIC_KEY?.trim();
  const configuredToken = process.env.DEVELOPER_MERCADOPAGO_SANDBOX_ACCESS_TOKEN?.trim();

  if (
    environment !== 'sandbox' ||
    !clientId ||
    !publicKey?.startsWith('TEST-') ||
    /^(tu_|your_|placeholder)/i.test(clientId)
  ) {
    return null;
  }

  let accessToken: string | null;
  if (configuredToken) {
    // An explicitly configured non-TEST token is rejected instead of silently
    // falling back to another credential that might belong to a different account.
    accessToken = configuredToken.startsWith('TEST-') ? configuredToken : null;
  } else if (clientSecret && !/^(tu_|your_|placeholder)/i.test(clientSecret)) {
    accessToken = await getSandboxAccessToken(clientId, clientSecret);
  } else {
    accessToken = null;
  }

  if (!accessToken) return null;
  return { accessToken, publicKey, accountScope: getAccountScope(clientId) };
}
