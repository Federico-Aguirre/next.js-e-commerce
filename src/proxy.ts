import { NextResponse, type NextRequest } from 'next/server'; // 🚀 ARREGLADO: Ambas importaciones ahora vienen de 'next/server'
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'llave-secreta-ultra-segura-de-32-caracteres-minimo'
);

export async function proxy(request: NextRequest) {
  // Intentamos obtener la cookie segura de sesión
  const sessionToken = request.cookies.get('senior_session')?.value;

  // Si intenta ir al checkout y no tiene la cookie, lo redirigimos al login
  if (request.nextUrl.pathname.startsWith('/checkout')) {
    if (!sessionToken) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // Verificamos si el token es real y no fue alterado
      await jwtVerify(sessionToken, JWT_SECRET);
      return NextResponse.next();
    } catch {
      // Token inválido o expirado -> Rebotar al login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Configuración Senior: El middleware solo se ejecuta en las rutas que especifiquemos aquí
export const config = {
  matcher: ['/checkout/:path*'],
};