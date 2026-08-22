import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

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

    // 🚀 ARREGLADO: Tu ID en Prisma es un string, forzamos el tipo correctamente para el findUnique
    const userIdStr = payload.userId as string;

    // Buscamos al usuario usando el ID string correcto
    const dbUser = await prisma.user.findUnique({
      where: { id: userIdStr },
      select: { id: true, name: true, email: true }
    });

    if (!dbUser) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
      }
    });

  } catch {
    return NextResponse.json({ authenticated: false, user: null }, { status: 500 });
  }
}