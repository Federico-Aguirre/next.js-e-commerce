import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('developer Mercado Pago sandbox credentials', () => {
  const fetchMock = vi.fn();
  let clientIdCounter = 0;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('MERCADOPAGO_ENVIRONMENT', 'sandbox');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DEVELOPER_MERCADOPAGO_CLIENT_ID', `test-client-${++clientIdCounter}`);
    vi.stubEnv('DEVELOPER_MERCADOPAGO_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('DEVELOPER_MERCADOPAGO_SANDBOX_ACCESS_TOKEN', '');
    vi.stubEnv('NEXT_PUBLIC_DEVELOPER_MERCADOPAGO_PUBLIC_KEY', 'TEST-public-key');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('obtains and caches a TEST token through client credentials without exposing it in the scope', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'TEST-private-token',
          expires_in: 21_600,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { getDeveloperMercadoPagoSandboxContext } =
      await import('./developer-mercadopago-sandbox');
    const first = await getDeveloperMercadoPagoSandboxContext();
    const second = await getDeveloperMercadoPagoSandboxContext();

    expect(first).toMatchObject({
      accessToken: 'TEST-private-token',
      publicKey: 'TEST-public-key',
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mercadopago.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        body: JSON.stringify({
          client_id: 'test-client-1',
          client_secret: 'test-client-secret',
          grant_type: 'client_credentials',
          test_token: true,
        }),
      }),
    );
    expect(first?.accountScope).toMatch(/^platform-pro-sandbox-[a-f0-9]{24}$/);
    expect(first?.accountScope).not.toContain('TEST-private-token');
  });

  it('does not allow a live or otherwise non-TEST access token in the sandbox flow', async () => {
    vi.stubEnv('DEVELOPER_MERCADOPAGO_SANDBOX_ACCESS_TOKEN', 'APP_USR-not-a-test-token');
    const { getDeveloperMercadoPagoSandboxContext } =
      await import('./developer-mercadopago-sandbox');

    await expect(getDeveloperMercadoPagoSandboxContext()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not enable Mercado Pago when the configured environment is not sandbox', async () => {
    vi.stubEnv('MERCADOPAGO_ENVIRONMENT', 'production');
    const { getDeveloperMercadoPagoSandboxContext } =
      await import('./developer-mercadopago-sandbox');

    await expect(getDeveloperMercadoPagoSandboxContext()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not expose the provider as ready if the OAuth endpoint cannot return a TEST token', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 }),
    );
    const { getDeveloperMercadoPagoSandboxContext } =
      await import('./developer-mercadopago-sandbox');

    await expect(getDeveloperMercadoPagoSandboxContext()).resolves.toBeNull();
  });
});
