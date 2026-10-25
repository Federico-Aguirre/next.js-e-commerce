import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/lib/I18nRouting';
import { buildAllowedCorsOrigins, getCorsHeadersForOrigin } from '@/lib/security/cors';

const intlMiddleware = createMiddleware(routing);

function getAllowedOrigins() {
  return buildAllowedCorsOrigins({
    configuredOrigins: process.env.CORS_ALLOWED_ORIGINS,
    siteUrls: [
      process.env.NEXTAUTH_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.NEXT_PUBLIC_APP_URL,
    ],
    nodeEnv: process.env.NODE_ENV,
  });
}

function attachCorsHeaders(response: NextResponse, headers: Record<string, string> | null) {
  response.headers.set('Vary', 'Origin');

  if (!headers) return response;

  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const corsHeaders = getCorsHeadersForOrigin(origin, getAllowedOrigins());

    // Reject an explicitly supplied but untrusted Origin before an API handler runs.
    // Requests without Origin (webhooks/native clients/server-to-server) do not use CORS.
    if (origin && !corsHeaders) {
      return NextResponse.json(
        { error: 'Forbidden origin' },
        {
          status: 403,
          headers: { Vary: 'Origin', 'Cache-Control': 'no-store' },
        },
      );
    }

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders ?? { Vary: 'Origin', 'Cache-Control': 'no-store' },
      });
    }

    return attachCorsHeaders(NextResponse.next(), corsHeaders);
  }

  // Pass the original visible path to the root server layout. It is used to show
  // the closed-store page everywhere except admin, account and in-flight order routes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nova-pathname', pathname);
  const requestWithPath = new NextRequest(request, { headers: requestHeaders });

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
    return NextResponse.rewrite(internalUrl, { request: { headers: requestHeaders } });
  }

  if (pathname === '/en/historial') {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (
    pathname === '/cart' ||
    pathname.startsWith('/product/') ||
    pathname === '/checkout' ||
    pathname.startsWith('/checkout/')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return intlMiddleware(requestWithPath);
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
