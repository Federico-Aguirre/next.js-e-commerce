import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth-options';

export default async function MetricsPage() {
  const cookieStore = await cookies();
  const rawCookies = cookieStore.getAll().map((c) => c.name);
  const session = await getServerSession(authOptions);

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h2>Diagnóstico de Servidor</h2>
      <p>
        <strong>Cookies que recibe el servidor:</strong>
      </p>
      <pre>{JSON.stringify(rawCookies, null, 2)}</pre>

      <p>
        <strong>Sesión desencriptada por NextAuth:</strong>
      </p>
      <pre>{JSON.stringify(session, null, 2)}</pre>
    </div>
  );
}
