export const dynamic = 'force-dynamic';
import 'dotenv/config';
import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
    }

    // 1. Validar si el email ya existe en el servidor
    const userExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      return NextResponse.json(
        { error: 'El correo electrónico ya está registrado' },
        { status: 400 },
      );
    }

    // 2. Encriptar la contraseña de forma segura
    const hashedPassword = await hash(password, 10);

    // 3. Crear el registro en la base de datos
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // 4. Retornamos éxito sin cookies intermedias redundantes
    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('Error en el controlador de registro:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error interno al registrar el usuario',
      },
      { status: 500 },
    );
  }
}
