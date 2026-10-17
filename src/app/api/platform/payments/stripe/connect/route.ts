import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { authOptions } from '@/lib/auth-options';
import {
  dashboardRedirect,
  isPlatformOwner,
  normalizeDashboardLocale,
  requestOrigin,
} from '@/lib/payments/onboarding';
import {
  getStorePaymentConnection,
  saveStorePaymentConnection,
} from '@/lib/payments/store-connections';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = normalizeDashboardLocale(url.searchParams.get('locale'));
  const origin = requestOrigin(request);

  if (!(await isPlatformOwner())) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, origin));
  }

  try {
    const secretKey = process.env.DEVELOPER_STRIPE_SECRET_KEY?.trim();
    if (!secretKey?.startsWith('sk_test_')) {
      throw new Error(
        'Stripe Connect sólo puede iniciarse con DEVELOPER_STRIPE_SECRET_KEY=sk_test_...',
      );
    }

    const session = await getServerSession(authOptions);
    const contactEmail = session?.user?.email?.trim().toLowerCase();
    if (!contactEmail) {
      throw new Error(
        'Stripe Connect necesita el email del dueño de la plataforma para crear la cuenta.',
      );
    }

    const stripe = new Stripe(secretKey);
    const current = await getStorePaymentConnection('STRIPE');
    let accountId = current?.externalAccountId;

    if (accountId) {
      const existing = await stripe.v2.core.accounts.retrieve(accountId, {
        include: ['configuration.recipient'],
      });
      if (existing.livemode) {
        throw new Error('La cuenta Connect encontrada es live; sandbox no permite usarla.');
      }
      if (existing.closed) {
        await saveStorePaymentConnection({ provider: 'STRIPE', status: 'CLOSED' });
        throw new Error('La cuenta Connect sandbox está cerrada y no se reutilizará.');
      }
    } else {
      const platformAccount = await stripe.accounts.retrieve(null);
      const country = platformAccount.country;
      if (!country) {
        throw new Error('Stripe no informó el país de la cuenta de plataforma sandbox.');
      }

      const account = await stripe.v2.core.accounts.create({
        contact_email: contactEmail,
        identity: { country },
        dashboard: 'express',
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: { requested: true },
              },
            },
          },
        },
        defaults: {
          locales: ['es-419'],
          responsibilities: {
            fees_collector: 'application',
            losses_collector: 'application',
          },
        },
        metadata: {
          store: 'default',
          environment: 'sandbox',
        },
      });
      if (account.livemode) {
        throw new Error('Stripe creó inesperadamente una cuenta live; se canceló el onboarding.');
      }
      accountId = account.id;
      await saveStorePaymentConnection({
        provider: 'STRIPE',
        externalAccountId: account.id,
        status: 'PENDING',
        metadata: { sandbox: true, dashboard: 'express', api: 'v2', country },
      });
    }

    const refreshUrl = new URL('/api/platform/payments/stripe/connect', origin);
    refreshUrl.searchParams.set('locale', locale);
    const returnUrl = new URL('/api/platform/payments/stripe/return', origin);
    returnUrl.searchParams.set('locale', locale);

    const accountLink = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['recipient'],
          collection_options: {
            fields: 'eventually_due',
            future_requirements: 'include',
          },
          refresh_url: refreshUrl.toString(),
          return_url: returnUrl.toString(),
        },
      },
    });

    return NextResponse.redirect(accountLink.url);
  } catch (error) {
    const stripeError = error as {
      type?: string;
      code?: string;
      message?: string;
      statusCode?: number;
      requestId?: string;
    };

    console.error('Stripe sandbox onboarding error:', error);

    try {
      await saveStorePaymentConnection({
        provider: 'STRIPE',
        status: 'REQUIRES_ACTION',
        metadata: {
          sandbox: true,
          stage: 'connect',
          errorType: stripeError.type ?? 'unknown',
          errorCode: stripeError.code ?? 'unknown',
          statusCode: stripeError.statusCode ?? 0,
          message: stripeError.message?.slice(0, 500) ?? 'Stripe onboarding error',
          requestId: stripeError.requestId ?? '',
        },
      });
    } catch (persistError) {
      console.error('No se pudo guardar el error de Stripe Connect.', persistError);
    }

    return NextResponse.redirect(dashboardRedirect(origin, locale, 'stripe', 'error'));
  }
}
