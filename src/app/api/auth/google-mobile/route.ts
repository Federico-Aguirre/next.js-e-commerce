import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Falta el idToken' }, { status: 400 });
    }

    // 1. Validar el token con Google
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );
    if (!googleRes.ok) {
      return NextResponse.json(
        { error: 'Token de Google inválido' },
        { status: 401 },
      );
    }

    const payload = await googleRes.json();
    const { email, name, picture } = payload;

    // 2. Buscar o crear usuario con Prisma
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          image: picture || null,
        },
      });
    }

    // 3. Crear sesión con NextAuth
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Falta NEXTAUTH_SECRET' },
        { status: 500 },
      );
    }

    const cookieName =
      process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token';

    const maxAge = 30 * 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);

    const sessionToken = await encode({
      token: {
        name: user.name,
        email: user.email,
        picture: user.image,
        sub: user.id,
        id: user.id,
        iat: now,
        exp: now + maxAge,
      },
      secret,
      maxAge,
      salt: cookieName,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    });

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error: any) {
    console.error('❌ [AUTH ERROR]:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno' },
      { status: 500 },
    );
  }
}
