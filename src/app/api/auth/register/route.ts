export const dynamic = 'force-dynamic';
import 'dotenv/config';

import { NextResponse } from 'next/server';
import { hashPassword, createSessionToken } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma'; // Instancia real de la BD

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
    }

    // 1. Validar si el email ya existe en Aiven
    const userExists = await prisma.user.findUnique({
      where: { email }
    });

    if (userExists) {
      return NextResponse.json({ error: 'El correo electrónico ya está registrado' }, { status: 400 });
    }

    // 2. Encriptar la contraseña localmente
    const hashedPassword = await hashPassword(password);

    // 3. Crear el registro REAL en la base de datos de la nube
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      }
    });

    // 4. Generar el token de sesión
    const token = await createSessionToken({ userId: newUser.id, email: newUser.email });

    const response = NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      }
    });

    // 5. Inyectar Cookie segura
    response.cookies.set('senior_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return response;

  } catch (error) {
    // Esto imprimirá el error real en la consola de tu terminal (donde corres npm run dev)
    console.error('DETALLE DEL ERROR EN EL SERVIDOR:', error);
    
    // Forzamos a que la respuesta sea SIEMPRE un JSON válido
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al registrar el usuario' }, 
      { status: 500 }
    );
  }
}