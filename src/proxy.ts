import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/lib/I18nRouting';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin') || 'http://localhost:8081';

  // 1. API routes & Mobile CORS handling
  if (pathname.startsWith('/api')) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning',
    };

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: corsHeaders });
    }

    const response = NextResponse.next();
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
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

  // Allow the internal default-locale rewrite to reach the App Router without
  // being canonicalized back to /historial a second time.
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

  // 2. Localized routing for storefront pages
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except static files and internal Next.js/Vercel paths
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
