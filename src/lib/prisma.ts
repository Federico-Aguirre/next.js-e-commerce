import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

// Tomamos la URL y le cortamos el "?sslmode=require" para que no rompa las opciones de abajo
const rawUrl = process.env.DATABASE_URL || '';
const cleanConnectionString = rawUrl.split('?')[0];

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: {
    rejectUnauthorized: false, // Ahora sí, al no haber "?sslmode" en la URL, este comando es obligatorio y absoluto
  },
});

const adapter = new PrismaPg(pool);

export const prisma = globalThis.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;