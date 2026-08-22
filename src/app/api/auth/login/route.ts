export const dynamic = 'force-dynamic';
import 'dotenv/config';

import { NextResponse } from 'next/server';
import { comparePassword, createSessionToken } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
    }

    // 1. Buscar al usuario real por su email en la nube
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // 🚀 ARREGLADO: Nos aseguramos de que el usuario exista Y que tenga password y email cargados
    if (!user || !user.password || !user.email) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // 2. Comparar el hash criptográfico de la contraseña (Ahora seguro porque TS sabe que no es null)
    const isPasswordCorrect = await comparePassword(password, user.password);

    if (!isPasswordCorrect) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // 3. Crear token con los datos reales (Ahora seguro porque TS sabe que no es null)
    const token = await createSessionToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      }
    });

    response.cookies.set('senior_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 });
  }
}