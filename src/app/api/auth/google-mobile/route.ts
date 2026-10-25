import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createMobileSessionResponse } from '@/lib/auth/mobile-session';
import { Env } from '@/lib/Env';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getRequestClientIp } from '@/lib/security/rate-limit';

const GoogleLoginSchema = z
  .object({
    idToken: z.string().min(20).max(8192),
  })
  .strict();

type GoogleTokenInfo = {
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  aud?: string;
  iss?: string;
};

export async function POST(request: Request) {
  const ip = getRequestClientIp(request);
  const rateLimit = checkRateLimit(`google-mobile:ip:${ip}`, {
    limit: 10,
    windowMs: 15 * 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Esperá unos minutos y volvé a intentar.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const parsed = GoogleLoginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Token de Google inválido.' }, { status: 400 });
    }

    const tokenInfoResponse = await fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(parsed.data.idToken),
      { signal: AbortSignal.timeout(5_000), cache: 'no-store' },
    );

    if (!tokenInfoResponse.ok) {
      return NextResponse.json({ error: 'Token de Google inválido.' }, { status: 401 });
    }

    const payload = (await tokenInfoResponse.json()) as GoogleTokenInfo;
    const configuredAudiences = [
      Env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_ID,
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);

    const issuerValid =
      payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com';
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    const email = payload.email?.trim().toLowerCase();

    if (
      !email ||
      !emailVerified ||
      !issuerValid ||
      configuredAudiences.length === 0 ||
      !configuredAudiences.includes(payload.aud || '')
    ) {
      return NextResponse.json(
        { error: 'No se pudo verificar la identidad de Google.' },
        { status: 401 },
      );
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: payload.name || email.split('@')[0],
          image: payload.picture || null,
        },
      });
    }

    return await createMobileSessionResponse({ ...user, email: user.email ?? email });
  } catch (error) {
    console.error(
      '[google-mobile-login] failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return NextResponse.json({ error: 'No se pudo iniciar sesión con Google.' }, { status: 500 });
  }
}
