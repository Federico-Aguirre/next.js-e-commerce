'use server';

import { hash } from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const authSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
});

const signUpSchema = authSchema.extend({
  name: z.string().optional(),
});

export type AuthState = {
  success?: boolean;
  error?: string;
} | null;

export async function signUpAction(_prevState: AuthState, formData: FormData): Promise<AuthState> {
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
