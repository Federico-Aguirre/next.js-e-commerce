import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  checkRateLimit,
  getRequestClientIp,
  hashRateLimitIdentity,
} from '@/lib/security/rate-limit';

const RegisterSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(10).max(128),
  })
  .strict();

export async function POST(request: Request) {
  const ip = getRequestClientIp(request);
  const ipLimit = checkRateLimit(`register:ip:${ip}`, {
    limit: 5,
    windowMs: 15 * 60_000,
  });

  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos de registro. Esperá unos minutos y volvé a intentar.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } },
    );
  }

  try {
    const parsed = RegisterSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Ingresá un nombre, un correo válido y una contraseña de al menos 10 caracteres.',
        },
        { status: 400 },
      );
    }

    const { name, email, password } = parsed.data;
    const identityLimit = checkRateLimit(`register:email:${hashRateLimitIdentity(email)}`, {
      limit: 3,
      windowMs: 60 * 60_000,
    });

    if (!identityLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos para este correo. Probá más tarde.' },
        { status: 429, headers: { 'Retry-After': String(identityLimit.retryAfterSeconds) } },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'No se pudo crear la cuenta. Verificá el correo e intentá iniciar sesión.' },
        { status: 409 },
      );
    }

    const hashedPassword = await hash(password, 12);
    const newUser = await prisma.user.create({
      data: { name, email, password: hashedPassword },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json(
      { success: true, user: newUser },
      { status: 201, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[register] failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'No se pudo crear la cuenta.' }, { status: 500 });
  }
}
