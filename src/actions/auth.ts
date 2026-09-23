'use server';

import { compare, hash } from 'bcryptjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { Env } from '@/lib/Env';
import { prisma } from '@/lib/prisma';

const authSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z
    .string()
    .min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
});

const signUpSchema = authSchema.extend({
  name: z.string().optional(),
});

export type AuthState = {
  success?: boolean;
  error?: string;
} | null;

export async function signUpAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rawData = Object.fromEntries(formData);
  const validation = signUpSchema.safeParse(rawData);

  if (!validation.success) {
    return { error: validation.error.issues[0]?.message };
  }

  const { name, email, password } = validation.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: 'El usuario ya existe con este correo.' };
  }

  const hashedPassword = await hash(password, 10);

  await prisma.user.create({
    data: {
      name: name ?? null,
      email,
      password: hashedPassword,
    },
  });

  return { success: true };
}

export async function signInAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rawData = Object.fromEntries(formData);
  const validation = authSchema.safeParse(rawData);

  if (!validation.success) {
    return { error: validation.error.issues[0]?.message };
  }

  const { email, password } = validation.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.password) {
    return { error: 'Credenciales inválidas.' };
  }

  const isValidPassword = await compare(password, user.password);
  if (!isValidPassword) {
    return { error: 'Credenciales inválidas.' };
  }

  const cookieStore = await cookies();
  cookieStore.set('session_user_id', user.id, {
    httpOnly: true,
    secure: Env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return { success: true };
}

export async function signOutAction(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  cookieStore.delete('session_user_id');
  return { success: true };
}
