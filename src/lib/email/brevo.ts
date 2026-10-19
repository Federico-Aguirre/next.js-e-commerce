import { createHash } from 'node:crypto';
import 'server-only';
import { Env } from '@/lib/Env';

export type BrevoEmailInput = {
  to: string;
  toName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
};

export type BrevoEmailResult = {
  messageId: string | null;
  deduplicated: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function createBrevoIdempotencyKey(seed: string): string {
  const namespace = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
  const digest = createHash('sha1').update(namespace).update(seed).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
export async function sendBrevoEmail(input: BrevoEmailInput): Promise<BrevoEmailResult> {
  const apiKey = Env.BREVO_API_KEY?.trim();
  const senderEmail = Env.BREVO_FROM_EMAIL?.trim();
  const senderName = Env.BREVO_FROM_NAME?.trim() || Env.STORE_PUBLIC_NAME?.trim() || 'Tu Ecommerce';

  if (!apiKey || !senderEmail) {
    throw new Error('BREVO_API_KEY and BREVO_FROM_EMAIL must be configured.');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: input.to, ...(input.toName ? { name: input.toName } : {}) }],
      ...(input.replyTo ? { replyTo: { email: input.replyTo } } : {}),
      subject: input.subject,
      htmlContent: input.html,
      ...(input.text ? { textContent: input.text } : {}),
      ...(input.idempotencyKey ? { headers: { idempotencyKey: input.idempotencyKey } } : {}),
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : undefined;

  if (!response.ok) {
    if (input.idempotencyKey && code === 'duplicate_parameter') {
      return { messageId: null, deduplicated: true };
    }

    throw new Error(
      `Brevo API request failed (HTTP ${response.status}${code ? `, ${code}` : ''}).`,
    );
  }

  return {
    messageId:
      isRecord(payload) && typeof payload.messageId === 'string' ? payload.messageId : null,
    deduplicated: false,
  };
}
