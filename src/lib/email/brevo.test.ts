import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { envMock, fetchMock } = vi.hoisted(() => ({
  envMock: {
    BREVO_API_KEY: undefined as string | undefined,
    BREVO_FROM_EMAIL: undefined as string | undefined,
    BREVO_FROM_NAME: undefined as string | undefined,
    STORE_PUBLIC_NAME: 'NOVA STORE' as string | undefined,
  },
  fetchMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/Env', () => ({ Env: envMock }));

import { createBrevoIdempotencyKey, sendBrevoEmail } from './brevo';

function mockResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

const emailInput = {
  to: 'buyer@example.com',
  toName: 'Ana',
  replyTo: 'support@example.com',
  subject: 'Compra confirmada',
  html: '<p>Tu pedido fue confirmado.</p>',
  text: 'Tu pedido fue confirmado.',
};

describe('Brevo transactional email sender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(envMock, {
      BREVO_API_KEY: 'xkeysib_test_key',
      BREVO_FROM_EMAIL: 'orders@example.com',
      BREVO_FROM_NAME: 'NOVA STORE',
      STORE_PUBLIC_NAME: 'NOVA STORE',
    });
    fetchMock.mockResolvedValue(mockResponse(201, { messageId: 'brevo-message-1' }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the expected payload to Brevo and returns the message ID', async () => {
    const idempotencyKey = createBrevoIdempotencyKey('purchase-confirmation:notification-1');
    expect(idempotencyKey).toBe(createBrevoIdempotencyKey('purchase-confirmation:notification-1'));
    expect(idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const result = await sendBrevoEmail({ ...emailInput, idempotencyKey });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': 'xkeysib_test_key',
          'content-type': 'application/json',
        },
        cache: 'no-store',
      }),
    );
    const requestOptions = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(requestOptions?.body))).toEqual({
      sender: { name: 'NOVA STORE', email: 'orders@example.com' },
      to: [{ email: 'buyer@example.com', name: 'Ana' }],
      replyTo: { email: 'support@example.com' },
      subject: 'Compra confirmada',
      htmlContent: '<p>Tu pedido fue confirmado.</p>',
      textContent: 'Tu pedido fue confirmado.',
      headers: { idempotencyKey },
    });
    expect(result).toEqual({ messageId: 'brevo-message-1', deduplicated: false });
  });

  it('does not call Brevo when its API key is missing', async () => {
    envMock.BREVO_API_KEY = undefined;

    await expect(sendBrevoEmail(emailInput)).rejects.toThrow(
      'BREVO_API_KEY and BREVO_FROM_EMAIL must be configured.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a deduplicated result when Brevo recognizes a repeated idempotency key', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(400, { code: 'duplicate_parameter' }));

    const result = await sendBrevoEmail({
      ...emailInput,
      idempotencyKey: createBrevoIdempotencyKey('purchase-confirmation:notification-1'),
    });

    expect(result).toEqual({ messageId: null, deduplicated: true });
  });

  it('reports provider errors without logging or exposing full provider payloads', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(401, {
        code: 'unauthorized',
        message: 'This provider response must not be exposed.',
      }),
    );

    await expect(sendBrevoEmail(emailInput)).rejects.toThrow(
      'Brevo API request failed (HTTP 401, unauthorized).',
    );
  });
});
