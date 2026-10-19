'use server';

import 'server-only';
import { headers } from 'next/headers';
import { sendBrevoEmail } from '@/lib/email/brevo';
import { Env } from '@/lib/Env';
import { contactSchema } from '@/lib/schemas/contactSchema';

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

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

export async function sendContactForm(formData: unknown) {
  // 1. IP rate limiting (Async in Next.js 15/16)
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';

  const now = Date.now();
  const userRate = rateLimitMap.get(ip) ?? { count: 0, lastReset: now };

  if (now - userRate.lastReset > 60_000) {
    userRate.count = 0;
    userRate.lastReset = now;
  }

  if (userRate.count >= 3) {
    return { success: false, error: 'rateLimitExceeded' };
  }

  userRate.count += 1;
  rateLimitMap.set(ip, userRate);

  // 2. Server-side Zod validation
  const result = contactSchema.safeParse(formData);

  if (!result.success) {
    return { success: false, error: 'invalidData' };
  }

  const { name, email, affair, consultation, hp_company, formTimestamp } = result.data;

  // 3. Honeypot check
  if (hp_company && hp_company.length > 0) {
    return { success: true };
  }

  // 4. Fill time check (minimum 3 seconds)
  if (now - formTimestamp < 3001) {
    return { success: false, error: 'submittedTooFast' };
  }

  // 5. Validate email configuration before trying to send
  const apiKey = Env.BREVO_API_KEY?.trim();
  const senderEmail = Env.BREVO_FROM_EMAIL?.trim();
  const recipientEmail = process.env.CONTACT_RECIPIENT_EMAIL?.trim();

  if (!apiKey || !senderEmail || !recipientEmail) {
    console.error('Contact email configuration is incomplete.', {
      hasBrevoApiKey: Boolean(apiKey),
      hasBrevoSender: Boolean(senderEmail),
      hasRecipientEmail: Boolean(recipientEmail),
    });
    return { success: false, error: 'configurationError' };
  }

  // 6. Send via Brevo's transactional email API
  try {
    await sendBrevoEmail({
      to: recipientEmail,
      replyTo: email,
      subject: `[Contacto Web] ${affair}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
          <h2 style="color: #09090b; border-bottom: 1px solid #e4e4e7; padding-bottom: 10px;">Nuevo mensaje de contacto</h2>
          <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email de respuesta:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
          <p><strong>Asunto:</strong> ${escapeHtml(affair)}</p>
          <div style="margin-top: 15px; padding: 15px; background-color: #f4f4f5; border-radius: 6px;">
            <p style="margin: 0; white-space: pre-wrap; color: #27272a;">${escapeHtml(consultation)}</p>
          </div>
        </div>
      `,
      text: `Nuevo mensaje de contacto\nNombre: ${name}\nEmail: ${email}\nAsunto: ${affair}\n\n${consultation}`,
    });

    return { success: true };
  } catch (error) {
    console.error('Contact email delivery failed.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return { success: false, error: 'serviceError' };
  }
}
