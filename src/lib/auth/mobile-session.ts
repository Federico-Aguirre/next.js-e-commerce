import 'server-only';
import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { resolveNextAuthSecret, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session-security';

type MobileSessionUser = {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
};

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

/**
 * Create a short-lived bearer token for the native app and a separately encoded
 * NextAuth cookie for browser clients. The bearer token deliberately contains
 * no role claims: protected routes load current permissions from the database.
 */
export async function createMobileSessionResponse(user: MobileSessionUser) {
  const secret = resolveNextAuthSecret(process.env.NEXTAUTH_SECRET, process.env.NODE_ENV);

  if (!secret) {
    return NextResponse.json(
      { error: 'El servicio de autenticación no está configurado.' },
      { status: 503 },
    );
  }

  const tokenPayload = {
    id: user.id,
    sub: user.id,
    email: user.email,
    name: user.name,
    picture: user.image ?? undefined,
  };

  // getToken() decodes Authorization: Bearer tokens with the default empty salt.
  const accessToken = await encode({
    token: tokenPayload,
    secret,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  // This project uses NextAuth v4, whose default JWT decoder uses an empty
  // salt for both the session cookie and Authorization: Bearer token.
  const cookieToken = accessToken;

  const response = NextResponse.json(
    {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image ?? null,
      },
      accessToken,
      tokenType: 'Bearer',
      expiresIn: SESSION_MAX_AGE_SECONDS,
    },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  );

  response.cookies.set(SESSION_COOKIE, cookieToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
