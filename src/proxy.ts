import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
  // Verificamos si el usuario tiene una sesión activa de Next-Auth
  // Pasamos el "secret" oficial para que pueda desencriptar la cookie nativa
  const session = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Si intenta ir al checkout y no está autenticado, directo al login
  if (request.nextUrl.pathname.startsWith('/checkout')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/checkout/:path*'],
};