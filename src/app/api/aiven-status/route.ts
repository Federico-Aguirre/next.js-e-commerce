import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

const AIVEN_API_BASE = 'https://api.aiven.io/v1';
const AIVEN_REQUEST_TIMEOUT_MS = 8_000;

type AivenEnvironment = {
  token: string;
  project: string;
  service: string;
};

type AivenPayload = {
  service?: {
    state?: unknown;
  };
};

function getAivenEnvironment(): AivenEnvironment | null {
  const token = process.env.AIVEN_API_TOKEN?.trim();
  const project = process.env.AIVEN_PROJECT_NAME?.trim();
  const service = process.env.AIVEN_SERVICE_NAME?.trim();

  if (!token || !project || !service) return null;

  return { token, project, service };
}

/**
 * Read the signed JWT cookie directly. This intentionally avoids a database
 * lookup because this endpoint exists to recover Aiven when its database is off.
 * The owner claim is minted/refreshed by the server-side NextAuth JWT callback.
 */
async function isPlatformOwnerRequest(request: Request): Promise<boolean> {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) return false;

  try {
    const token = await getToken({
      req: request as NextRequest,
      secret,
      secureCookie: process.env.NODE_ENV === 'production',
    });
    return token?.isPlatformOwner === true;
  } catch {
    return false;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function getServiceUrl(config: AivenEnvironment) {
  return (
    AIVEN_API_BASE +
    '/project/' +
    encodeURIComponent(config.project) +
    '/service/' +
    encodeURIComponent(config.service)
  );
}

async function getServiceState(config: AivenEnvironment) {
  const response = await fetch(getServiceUrl(config), {
    headers: {
      Authorization:
        config.token.startsWith('aivenv1 ') || config.token.startsWith('Bearer ')
          ? config.token
          : 'aivenv1 ' + config.token,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(AIVEN_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error('[Aiven status] Provider request failed with status:', response.status);
    return { ok: false as const, status: response.status, state: null };
  }

  let payload: AivenPayload;
  try {
    payload = (await response.json()) as AivenPayload;
  } catch {
    console.error('[Aiven status] Provider returned an invalid response body.');
    return { ok: false as const, status: 502, state: null };
  }

  if (typeof payload.service?.state !== 'string') {
    console.error('[Aiven status] Provider response did not contain a service state.');
    return { ok: false as const, status: 502, state: null };
  }

  return { ok: true as const, status: response.status, state: payload.service.state };
}

export async function GET(request: Request) {
  if (!(await isPlatformOwnerRequest(request))) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const config = getAivenEnvironment();
  if (!config) {
    console.error('[Aiven status] Required server configuration is missing.');
    return jsonResponse({ status: 'ERROR' }, 503);
  }

  try {
    const result = await getServiceState(config);
    if (!result.ok) return jsonResponse({ status: 'ERROR' }, 502);

    if (result.state === 'RUNNING') return jsonResponse({ status: 'READY' });
    if (result.state === 'POWEROFF') return jsonResponse({ status: 'SLEEPING' });

    return jsonResponse({ status: 'WAKING_UP' });
  } catch (error) {
    console.error(
      '[Aiven status] Provider request failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return jsonResponse({ status: 'ERROR' }, 502);
  }
}

export async function POST(request: Request) {
  if (!(await isPlatformOwnerRequest(request))) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const config = getAivenEnvironment();
  if (!config) {
    console.error('[Aiven status] Required server configuration is missing.');
    return jsonResponse({ status: 'ERROR' }, 503);
  }

  try {
    const current = await getServiceState(config);
    if (!current.ok) return jsonResponse({ status: 'ERROR' }, 502);
    if (current.state === 'RUNNING') return jsonResponse({ status: 'READY' });

    if (current.state === 'POWEROFF') {
      const response = await fetch(getServiceUrl(config), {
        method: 'PUT',
        headers: {
          Authorization:
            config.token.startsWith('aivenv1 ') || config.token.startsWith('Bearer ')
              ? config.token
              : 'aivenv1 ' + config.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ powered: true }),
        cache: 'no-store',
        signal: AbortSignal.timeout(AIVEN_REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        console.error('[Aiven wake] Provider request failed with status:', response.status);
        return jsonResponse({ status: 'ERROR' }, 502);
      }
    }

    return jsonResponse({ status: 'WAKING_UP' }, 202);
  } catch (error) {
    console.error(
      '[Aiven wake] Provider request failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return jsonResponse({ status: 'ERROR' }, 502);
  }
}
