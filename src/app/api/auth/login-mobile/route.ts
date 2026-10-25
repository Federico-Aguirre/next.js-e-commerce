import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createMobileSessionResponse } from '@/lib/auth/mobile-session';
import { prisma } from '@/lib/prisma';
import {
  checkRateLimit,
  getRequestClientIp,
  hashRateLimitIdentity,
} from '@/lib/security/rate-limit';

const LoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

export async function POST(request: Request) {
  const ip = getRequestClientIp(request);
  const ipLimit = checkRateLimit(`mobile-login:ip:${ip}`, {
    limit: 10,
    windowMs: 15 * 60_000,
  });

  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Esperá unos minutos y volvé a intentar.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } },
    );
  }

  try {
    const parsed = LoginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Correo electrónico o contraseña incorrectos.' },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const identityLimit = checkRateLimit(`mobile-login:email:${hashRateLimitIdentity(email)}`, {
      limit: 8,
      windowMs: 15 * 60_000,
    });

    if (!identityLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Esperá unos minutos y volvé a intentar.' },
        { status: 429, headers: { 'Retry-After': String(identityLimit.retryAfterSeconds) } },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user?.password ? await bcrypt.compare(password, user.password) : false;

    if (!user || !valid) {
      return NextResponse.json(
        { error: 'Correo electrónico o contraseña incorrectos.' },
        { status: 401 },
      );
    }

    return await createMobileSessionResponse({ ...user, email: user.email ?? email });
  } catch (error) {
    console.error('[mobile-login] failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'No se pudo iniciar sesión.' }, { status: 500 });
  }
}
