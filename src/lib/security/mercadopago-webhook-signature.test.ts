import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMercadoPagoSignature } from './mercadopago-webhook-signature';

const secret = 'unit-test-webhook-secret';
const timestamp = '1730000000';
const requestId = 'request-test-123';
const dataId = '123456789';

function signedRequest(id = dataId) {
  const manifest = 'id:' + id.toLowerCase() + ';request-id:' + requestId + ';ts:' + timestamp + ';';
  const signature = createHmac('sha256', secret).update(manifest).digest('hex');

  return new Request(
    'https://store.example/api/webhooks/mercadopago?type=payment&data.id=' + encodeURIComponent(id),
    {
      headers: {
        'x-request-id': requestId,
        'x-signature': 'ts=' + timestamp + ',v1=' + signature,
      },
    },
  );
}

describe('verifyMercadoPagoSignature', () => {
  it('accepts a valid provider signature', () => {
    expect(verifyMercadoPagoSignature(signedRequest(), secret)).toBe(true);
  });

  it('accepts an alphanumeric Orders API ID and normalizes it to lowercase for the signature', () => {
    expect(verifyMercadoPagoSignature(signedRequest('ORD01JQ4S4KY8HWQ6NA5PXB65B3D3'), secret)).toBe(
      true,
    );
  });

  it('rejects a signature reused for a different payment ID', () => {
    const original = signedRequest();
    const tampered = new Request(original.url.replace('data.id=' + dataId, 'data.id=987654321'), {
      headers: original.headers,
    });
    expect(verifyMercadoPagoSignature(tampered, secret)).toBe(false);
  });

  it('rejects a signature reused with a different request ID', () => {
    const original = signedRequest();
    const tampered = new Request(original.url, {
      headers: {
        'x-request-id': 'different-request',
        'x-signature': original.headers.get('x-signature') || '',
      },
    });
    expect(verifyMercadoPagoSignature(tampered, secret)).toBe(false);
  });

  it('rejects a malformed or missing signature', () => {
    const original = signedRequest();
    const tampered = new Request(original.url, {
      headers: {
        'x-request-id': requestId,
        'x-signature': 'not-a-signature',
      },
    });
    expect(verifyMercadoPagoSignature(tampered, secret)).toBe(false);
    expect(
      verifyMercadoPagoSignature(
        new Request('https://store.example/api/webhooks/mercadopago?data.id=123456789'),
        secret,
      ),
    ).toBe(false);
  });
});
