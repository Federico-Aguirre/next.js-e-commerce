// src/lib/prisma-retry.ts
export async function prismaWithRetry<T>(
  queryFn: () => Promise<T>,
  retries = 8,
  delayMs = 4000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await queryFn();
    } catch (error: any) {
      const isConnectionError =
        error?.message?.includes("Can't reach database server") ||
        error?.code === 'P1001' ||
        error?.code === 'ECONNREFUSED';

      if (isConnectionError && i < retries - 1) {
        console.warn(
          `[Aiven DB] Servidor no alcanzable. Reintentando (${i + 1}/${retries}) en ${delayMs / 1000}s...`
        );
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        throw error;
      }
    }
  }
  throw new Error('No se pudo establecer conexión con la base de datos.');
}