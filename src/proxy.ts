import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/lib/I18nRouting';

const intlMiddleware = createMiddleware(routing);

function getAllowedOrigins() {
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const siteOrigins = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  const developmentOrigins =
    process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:8081'];

  return new Set([...configuredOrigins, ...siteOrigins, ...developmentOrigins]);
}

function corsHeadersFor(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || !getAllowedOrigins().has(origin)) return null;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Accept, ngrok-skip-browser-warning',
    Vary: 'Origin',
  };
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api')) {
    const corsHeaders = corsHeadersFor(request);

    if (request.method === 'OPTIONS') {
      // Cross-origin browser clients must be explicitly listed in CORS_ALLOWED_ORIGINS.
      return new NextResponse(null, {
        status: corsHeaders ? 204 : request.headers.get('origin') ? 403 : 204,
        headers: corsHeaders ?? { Vary: 'Origin' },
      });
    }

    const response = NextResponse.next();
    if (corsHeaders) {
      Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
    }
    return response;
  }

  // History lives under [locale], but next-intl's as-needed canonicalization
  // can loop /historial -> /en/historial -> /historial on the default locale.
  if (pathname === '/historial') {
    const locale = request.cookies.get('NEXT_LOCALE')?.value;

    if (locale === 'es') {
      const localizedUrl = request.nextUrl.clone();
      localizedUrl.pathname = '/es/historial';
      return NextResponse.redirect(localizedUrl);
    }

    const internalUrl = request.nextUrl.clone();
    internalUrl.pathname = '/en/historial';
    return NextResponse.rewrite(internalUrl);
  }

  if (pathname === '/en/historial') {
    return NextResponse.next();
  }

  if (
    pathname === '/cart' ||
    pathname.startsWith('/product/') ||
    pathname === '/checkout' ||
    pathname.startsWith('/checkout/')
  ) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
