import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Validate Mercado Pago's documented x-signature manifest for Webhooks:
 * id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 */
export function verifyMercadoPagoSignature(request: Request, secret: string): boolean {
  const url = new URL(request.url);
  const signatureHeader = request.headers.get('x-signature');
  const requestId = request.headers.get('x-request-id');
  const dataId = url.searchParams.get('data.id')?.toLowerCase();

  if (!signatureHeader || !requestId || !dataId || !/^[a-z0-9]{1,64}$/.test(dataId)) {
    return false;
  }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const separator = part.indexOf('=');
      return separator > 0
        ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
        : ['', ''];
    }),
  );
  const timestamp = parts.ts;
  const signature = parts.v1;

  if (!timestamp || !/^\d+$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const manifest = 'id:' + dataId + ';request-id:' + requestId + ';ts:' + timestamp + ';';
  const expected = createHmac('sha256', secret).update(manifest).digest();
  const received = Buffer.from(signature, 'hex');

  return received.length === expected.length && timingSafeEqual(received, expected);
}
