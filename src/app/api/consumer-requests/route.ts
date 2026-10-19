import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBrevoIdempotencyKey, sendBrevoEmail } from '@/lib/email/brevo';
import { Env } from '@/lib/Env';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  email: z.string().trim().email().max(254),
  orderNumber: z.string().trim().max(10).regex(/^\d*$/).optional().default(''),
  details: z.string().trim().max(2000).optional().default(''),
  locale: z.enum(['es', 'en']).optional().default('es'),
});

const rateLimit = new Map<string, { count: number; startedAt: number }>();

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return replacements[character] ?? character;
  });
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const previous = rateLimit.get(ip);
  if (!previous || now - previous.startedAt >= 10 * 60 * 1000) {
    rateLimit.set(ip, { count: 1, startedAt: now });
    return true;
  }
  if (previous.count >= 5) return false;
  previous.count += 1;
  return true;
}

export async function POST(request: Request) {
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: 'rateLimitExceeded' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalidJson' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalidData' }, { status: 400 });
  }

  const email = parsed.data.email;
  const details = parsed.data.details;
  const orderNumber = parsed.data.orderNumber ? Number(parsed.data.orderNumber) : null;
  const locale = parsed.data.locale;
  const requestCode =
    'AR-' + new Date().getFullYear() + '-' + randomBytes(4).toString('hex').toUpperCase();

  const registered = await prisma.consumerRequest.create({
    data: {
      requestCode,
      requestType: 'WITHDRAWAL',
      orderNumber,
      customerEmail: email,
      details: details || null,
      locale,
      status: 'RECEIVED',
    },
    select: { requestCode: true, createdAt: true },
  });

  const apiKey = Env.BREVO_API_KEY?.trim();
  const senderEmail = Env.BREVO_FROM_EMAIL?.trim();
  const recipientEmail =
    Env.STORE_LEGAL_EMAIL?.trim() || process.env.CONTACT_RECIPIENT_EMAIL?.trim();

  if (apiKey && senderEmail && recipientEmail) {
    const safeEmail = escapeHtml(email);
    const safeDetails = escapeHtml(
      details || (locale === 'es' ? 'Sin información adicional.' : 'No additional details.'),
    );
    const safeOrderText =
      orderNumber === null
        ? locale === 'es'
          ? 'No indicado'
          : 'Not provided'
        : String(orderNumber);
    const createdAt = registered.createdAt.toISOString();
    const spanish = locale === 'es';

    const sellerHtml =
      '<div style="font-family:Arial,sans-serif;line-height:1.6">' +
      '<h2>' +
      (spanish ? 'Nueva solicitud de arrepentimiento' : 'New withdrawal request') +
      '</h2>' +
      '<p><strong>' +
      (spanish ? 'Código' : 'Reference code') +
      ':</strong> ' +
      requestCode +
      '</p>' +
      '<p><strong>' +
      (spanish ? 'Correo' : 'Email') +
      ':</strong> ' +
      safeEmail +
      '</p>' +
      '<p><strong>' +
      (spanish ? 'Número de pedido' : 'Order number') +
      ':</strong> ' +
      safeOrderText +
      '</p>' +
      '<p><strong>' +
      (spanish ? 'Fecha UTC' : 'UTC date') +
      ':</strong> ' +
      createdAt +
      '</p>' +
      '<p><strong>' +
      (spanish ? 'Información adicional' : 'Additional information') +
      ':</strong></p>' +
      '<p style="white-space:pre-wrap">' +
      safeDetails.replace(/\n/g, '<br>') +
      '</p>' +
      '<p>' +
      (spanish
        ? 'La solicitud fue guardada en el sistema; revisala y respondé dentro del plazo legal.'
        : 'The request has been saved; review it and respond within the legal time limit.') +
      '</p>' +
      '</div>';

    const customerHtml =
      '<div style="font-family:Arial,sans-serif;line-height:1.6">' +
      '<h2>' +
      (spanish ? 'Registramos tu solicitud' : 'Your request has been registered') +
      '</h2>' +
      '<p>' +
      (spanish ? 'Este es tu código de referencia:' : 'Your reference code is:') +
      '</p>' +
      '<p style="font-size:20px;font-weight:bold">' +
      requestCode +
      '</p>' +
      '<p>' +
      (spanish
        ? 'El código confirma el registro de tu solicitud; no significa que el reembolso ya se haya ejecutado. El comercio revisará la información y te comunicará los pasos siguientes.'
        : 'This code confirms registration; it does not mean that a refund has already been issued. The store will review the information and communicate the next steps.') +
      '</p>' +
      '</div>';

    const results = await Promise.allSettled([
      sendBrevoEmail({
        to: recipientEmail,
        replyTo: email,
        subject: '[Arrepentimiento] ' + requestCode,
        html: sellerHtml,
        idempotencyKey: createBrevoIdempotencyKey(`consumer-request:${requestCode}:seller`),
      }),
      sendBrevoEmail({
        to: email,
        replyTo: recipientEmail,
        subject: (spanish ? 'Solicitud registrada: ' : 'Request registered: ') + requestCode,
        html: customerHtml,
        idempotencyKey: createBrevoIdempotencyKey(`consumer-request:${requestCode}:customer`),
      }),
    ]);

    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.error('Consumer request notification email failed.', {
          requestCode,
          rejected: true,
        });
      }
    });
  } else {
    console.error('Consumer request registered but email notification is not configured.', {
      requestCode,
      hasBrevoApiKey: Boolean(apiKey),
      hasBrevoSender: Boolean(senderEmail),
      hasRecipient: Boolean(recipientEmail),
    });
  }

  return NextResponse.json({
    success: true,
    requestCode: registered.requestCode,
  });
}
