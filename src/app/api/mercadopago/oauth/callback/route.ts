import https from 'node:https';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  dashboardRedirect,
  isPlatformOwner,
  normalizeDashboardLocale,
  requestOrigin,
} from '@/lib/payments/onboarding';
import { saveStorePaymentConnection } from '@/lib/payments/store-connections';

export const dynamic = 'force-dynamic';

type MercadoPagoOauthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number | string;
  public_key?: string;
  scope?: string;
  live_mode?: boolean;
  message?: string;
  error?: string;
};

type MercadoPagoHttpResponse<T> = {
  status: number;
  data: T;
  requestId: string | null;
};

function mercadoPagoHttpsRequest<T>(input: {
  path: string;
  method?: 'GET' | 'POST';
  accessToken?: string;
  body?: unknown;
}) {
  const payload = input.body == null ? undefined : JSON.stringify(input.body);

  return new Promise<MercadoPagoHttpResponse<T>>((resolve, reject) => {
    const request = https.request(
      {
        hostname: 'api.mercadopago.com',
        port: 443,
        path: input.path,
        method: input.method ?? 'GET',
        family: 4,
        timeout: 15_000,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data: T;
          try {
            data = (text ? JSON.parse(text) : {}) as T;
          } catch {
            return reject(
              new Error(
                `Mercado Pago devolvió una respuesta no JSON (HTTP ${response.statusCode ?? 0}).`,
              ),
            );
          }

          resolve({
            status: response.statusCode ?? 0,
            data,
            requestId:
              typeof response.headers['x-request-id'] === 'string'
                ? response.headers['x-request-id']
                : null,
          });
        });
      },
    );

    request.on('timeout', () => request.destroy(new Error('Mercado Pago OAuth timeout.')));
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function mercadoPagoHttpsRequestWithRetry<T>(
  input: Parameters<typeof mercadoPagoHttpsRequest<T>>[0],
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await mercadoPagoHttpsRequest<T>(input);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function mercadoPagoUserId(accessToken: string) {
  const response = await mercadoPagoHttpsRequestWithRetry<{ id?: number | string }>({
    path: '/users/me',
    accessToken,
  });
  if (response.status < 200 || response.status >= 300) return null;
  return response.data.id == null ? null : String(response.data.id);
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get('mp_oauth_locale')?.value ?? null);

  if (!(await isPlatformOwner())) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, origin));
  }

  let status = 'error';
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code')?.trim();
    const state = url.searchParams.get('state')?.trim();
    const expectedState = cookieStore.get('mp_oauth_state')?.value;
    const verifier = cookieStore.get('mp_oauth_verifier')?.value;

    if (!code || !state || !expectedState || !verifier || state !== expectedState) {
      throw new Error('La respuesta OAuth de Mercado Pago no superó la validación de estado/PKCE.');
    }

    const clientId = process.env.DEVELOPER_MERCADOPAGO_CLIENT_ID?.trim();
    const clientSecret = process.env.DEVELOPER_MERCADOPAGO_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('Faltan las credenciales de la aplicación de Mercado Pago.');
    }

    const callback = new URL('/api/mercadopago/oauth/callback', origin);
    const tokenResponse = await mercadoPagoHttpsRequestWithRetry<MercadoPagoOauthResponse>({
      path: '/oauth/token',
      method: 'POST',
      body: {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callback.toString(),
        code_verifier: verifier,
        test_token: true,
      },
    });
    const data = tokenResponse.data;

    if (tokenResponse.status < 200 || tokenResponse.status >= 300 || !data.access_token) {
      throw new Error(
        `${data.message || data.error || 'Mercado Pago no devolvió un Access Token sandbox.'}${
          tokenResponse.requestId ? ` (requestId: ${tokenResponse.requestId})` : ''
        }`,
      );
    }
    if (data.live_mode === true) {
      throw new Error(
        'Mercado Pago devolvió credenciales live; se rechazaron para mantener sandbox.',
      );
    }

    const authorizedUserId = data.user_id == null ? null : String(data.user_id);
    const standaloneToken = process.env.STORE_MERCADOPAGO_ACCESS_TOKEN?.trim();
    if (standaloneToken) {
      const expectedSellerUserId = await mercadoPagoUserId(standaloneToken);
      if (expectedSellerUserId && authorizedUserId !== expectedSellerUserId) {
        throw new Error(
          `La cuenta autorizada por OAuth (${authorizedUserId ?? 'desconocida'}) no coincide con la cuenta del comercio configurada (${expectedSellerUserId}).`,
        );
      }
    }

    await saveStorePaymentConnection({
      provider: 'MERCADOPAGO',
      externalAccountId: data.user_id == null ? null : String(data.user_id),
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      tokenExpiresAt: data.expires_in
        ? new Date(Date.now() + Number(data.expires_in) * 1000)
        : null,
      status: 'ACTIVE',
      metadata: {
        sandbox: true,
        publicKey: data.public_key ?? null,
        scope: data.scope ?? null,
        liveMode: false,
      },
    });
    status = 'connected';
  } catch (error) {
    console.error('Mercado Pago sandbox OAuth callback error:', error);
  }

  const response = NextResponse.redirect(dashboardRedirect(origin, locale, 'mercadopago', status));
  for (const name of ['mp_oauth_state', 'mp_oauth_verifier', 'mp_oauth_locale']) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: origin.startsWith('https://'),
      maxAge: 0,
      path: '/api/mercadopago/oauth',
    });
  }
  return response;
}
