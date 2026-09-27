import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(10),
  NEXT_PUBLIC_SITE_URL: z.string().url(),

  // Variables para monitoreo con Better Stack / Logtail (opcionales)
  NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
  NEXT_PUBLIC_BETTER_STACK_INGESTING_URL: z.string().optional(),
});

// Rompe la ejecución inmediatamente si falta una variable requerida
export const env = envSchema.parse(process.env);

// Exportación alternativa para soportar importaciones con 'Env'
export const Env = env;
