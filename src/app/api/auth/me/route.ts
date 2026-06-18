import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma'; // Importamos el prisma que reparamos antes

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/senior_session=([^;]+)/);
    const token = match ? match[1] : null;

    if (!token) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const payload = await verifySessionToken(token);

    if (!payload || !payload.userId) {
      const response = NextResponse.json({ authenticated: false, user: null });
      response.cookies.delete('senior_session');
      return response;
    }

    // ¡AHORA SÍ! Buscamos al usuario real en la base de datos de Aiven
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true } // Traemos solo lo necesario
    });

    if (!dbUser) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: dbUser.id,
        name: dbUser.name, // <--- Este es el nombre real de la base de datos
        email: dbUser.email,
      }
    });

  } catch {
    return NextResponse.json({ authenticated: false, user: null }, { status: 500 });
  }
}