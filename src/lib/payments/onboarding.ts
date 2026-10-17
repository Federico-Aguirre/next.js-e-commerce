import 'server-only';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export function normalizeDashboardLocale(value: string | null) {
  return value === 'en' ? 'en' : 'es';
}

export function requestOrigin(request: Request) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`;
  return request.headers.get('origin') || new URL(request.url).origin;
}

export function dashboardRedirect(
  origin: string,
  locale: string,
  provider: 'mercadopago' | 'paypal' | 'stripe',
  status: string,
) {
  const url = new URL(`/${locale}/dashboard`, origin);
  url.searchParams.set('paymentProvider', provider);
  url.searchParams.set('paymentStatus', status);
  return url;
}

export async function isPlatformOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return false;

  const user = session.user.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isPlatformOwner: true },
      })
    : session.user.email
      ? await prisma.user.findUnique({
          where: { email: session.user.email.toLowerCase() },
          select: { isPlatformOwner: true },
        })
      : null;

  return user?.isPlatformOwner === true;
}

export function assertPayPalSandbox() {
  if (
    process.env.PAYPAL_ENVIRONMENT === 'production' ||
    process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT === 'production'
  ) {
    throw new Error('El onboarding de PayPal está bloqueado: el proyecto debe seguir en sandbox.');
  }
}

export async function paypalPlatformAccessToken() {
  assertPayPalSandbox();
  const clientId = process.env.DEVELOPER_PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.DEVELOPER_PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('Faltan las credenciales sandbox de la plataforma PayPal.');
  }

  const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || 'No se pudo autenticar la plataforma PayPal sandbox.',
    );
  }
  return data.access_token;
}
