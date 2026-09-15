import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(10),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

// Rompe la ejecución inmediatamente si falta una variable requerida
export const env = envSchema.parse(process.env);
