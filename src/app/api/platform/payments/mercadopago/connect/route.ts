import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  dashboardRedirect,
  isPlatformOwner,
  normalizeDashboardLocale,
  requestOrigin,
} from '@/lib/payments/onboarding';

export const dynamic = 'force-dynamic';

function base64url(value: Buffer) {
  return value.toString('base64url');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = normalizeDashboardLocale(url.searchParams.get('locale'));
  const origin = requestOrigin(request);
  const secureSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!origin.startsWith('https://') && secureSiteUrl?.startsWith('https://')) {
    const secureStart = new URL('/api/platform/payments/mercadopago/connect', secureSiteUrl);
    secureStart.searchParams.set('locale', locale);
    return NextResponse.redirect(secureStart);
  }

  if (!(await isPlatformOwner())) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, origin));
  }

  try {
    const clientId = process.env.DEVELOPER_MERCADOPAGO_CLIENT_ID?.trim();
    const clientSecret = process.env.DEVELOPER_MERCADOPAGO_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('Faltan Client ID/Secret de la aplicación de Mercado Pago.');
    }

    const state = base64url(randomBytes(24));
    const verifier = base64url(randomBytes(48));
    const challenge = base64url(createHash('sha256').update(verifier).digest());
    const callback = new URL('/api/mercadopago/oauth/callback', origin);

    const authorization = new URL('https://auth.mercadopago.com.ar/authorization');
    authorization.searchParams.set('client_id', clientId);
    authorization.searchParams.set('response_type', 'code');
    authorization.searchParams.set('platform_id', 'mp');
    // Solicita un OAuth access token TEST para la cuenta del vendedor autorizada.
    authorization.searchParams.set('test_token', 'true');
    authorization.searchParams.set('state', state);
    authorization.searchParams.set('redirect_uri', callback.toString());
    authorization.searchParams.set('code_challenge', challenge);
    authorization.searchParams.set('code_challenge_method', 'S256');
    authorization.searchParams.set('scope', 'offline_access');

    const response = NextResponse.redirect(authorization);
    const secure = origin.startsWith('https://');
    response.cookies.set('mp_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 10 * 60,
      path: '/api/mercadopago/oauth',
    });
    response.cookies.set('mp_oauth_verifier', verifier, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 10 * 60,
      path: '/api/mercadopago/oauth',
    });
    response.cookies.set('mp_oauth_locale', locale, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 10 * 60,
      path: '/api/mercadopago/oauth',
    });
    return response;
  } catch (error) {
    console.error('Mercado Pago sandbox OAuth start error:', error);
    return NextResponse.redirect(dashboardRedirect(origin, locale, 'mercadopago', 'error'));
  }
}
