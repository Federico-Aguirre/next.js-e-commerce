import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Faltan credenciales' },
        { status: 400 },
      );
    }

    // 1. Buscar usuario en Prisma
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'Usuario no encontrado o creado mediante Google' },
        { status: 401 },
      );
    }

    // 2. Validar la contraseña encriptada
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Contraseña incorrecta' },
        { status: 401 },
      );
    }

    // 3. Crear token de sesión con NextAuth (Misma lógica que google-mobile)
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
    console.error('❌ [LOGIN ERROR]:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno' },
      { status: 500 },
    );
  }
}
