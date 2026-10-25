import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getTokenMock } = vi.hoisted(() => ({ getTokenMock: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: getTokenMock }));

import { GET, POST } from './route';

function providerResponse(state: string, status = 200) {
  return new Response(JSON.stringify({ service: { state } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/aiven-status access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXTAUTH_SECRET', 'test-only-secret-that-is-long-enough');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('AIVEN_API_TOKEN', 'test-aiven-token');
    vi.stubEnv('AIVEN_PROJECT_NAME', 'test-project');
    vi.stubEnv('AIVEN_SERVICE_NAME', 'test-service');
    getTokenMock.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects an unauthenticated status request without contacting Aiven', async () => {
    const response = await GET(new Request('http://localhost:3001/api/aiven-status'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows the platform owner to check status without waking the service', async () => {
    getTokenMock.mockResolvedValue({ isPlatformOwner: true });
    vi.mocked(fetch).mockResolvedValueOnce(providerResponse('POWEROFF'));

    const response = await GET(new Request('http://localhost:3001/api/aiven-status'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'SLEEPING' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][1]).toEqual(
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('returns ready for a running service without issuing a wake request', async () => {
    getTokenMock.mockResolvedValue({ isPlatformOwner: true });
    vi.mocked(fetch).mockResolvedValueOnce(providerResponse('RUNNING'));

    const response = await GET(new Request('http://localhost:3001/api/aiven-status'));

    expect(await response.json()).toEqual({ status: 'READY' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects an unauthenticated wake request', async () => {
    const response = await POST(
      new Request('http://localhost:3001/api/aiven-status', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('wakes a powered-off service only for a platform-owner JWT', async () => {
    getTokenMock.mockResolvedValue({ isPlatformOwner: true });
    vi.mocked(fetch)
      .mockResolvedValueOnce(providerResponse('POWEROFF'))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const response = await POST(
      new Request('http://localhost:3001/api/aiven-status', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: 'WAKING_UP' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ powered: true }),
        cache: 'no-store',
      }),
    );
  });

  it('does not reveal provider error bodies or internal causes', async () => {
    getTokenMock.mockResolvedValue({ isPlatformOwner: true });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('provider-secret-error-detail', { status: 500 }),
    );

    const response = await GET(new Request('http://localhost:3001/api/aiven-status'));
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(body).toBe(JSON.stringify({ status: 'ERROR' }));
    expect(body).not.toContain('provider-secret-error-detail');
  });

  it('fails closed with a generic response when Aiven configuration is missing', async () => {
    getTokenMock.mockResolvedValue({ isPlatformOwner: true });
    vi.stubEnv('AIVEN_API_TOKEN', '');

    const response = await POST(
      new Request('http://localhost:3001/api/aiven-status', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'ERROR' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
