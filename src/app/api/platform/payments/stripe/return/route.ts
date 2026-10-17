import { NextResponse } from 'next/server';
import Stripe from 'stripe';
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
    const connection = await getStorePaymentConnection('STRIPE');
    if (!secretKey?.startsWith('sk_test_') || !connection?.externalAccountId) {
      throw new Error('No existe una cuenta Stripe Connect sandbox pendiente.');
    }

    const stripe = new Stripe(secretKey);
    const account = await stripe.v2.core.accounts.retrieve(connection.externalAccountId, {
      include: ['configuration.recipient', 'requirements'],
    });
    const transferStatus =
      account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
    const active = !account.livemode && !account.closed && transferStatus === 'active';

    await saveStorePaymentConnection({
      provider: 'STRIPE',
      externalAccountId: account.id,
      status: active ? 'ACTIVE' : account.closed ? 'CLOSED' : 'REQUIRES_ACTION',
      metadata: {
        sandbox: true,
        dashboard: account.dashboard ?? 'express',
        api: 'v2',
        transferStatus: transferStatus ?? 'unknown',
      },
    });

    return NextResponse.redirect(
      dashboardRedirect(origin, locale, 'stripe', active ? 'connected' : 'requires_action'),
    );
  } catch (error) {
    console.error('Stripe sandbox onboarding return error:', error);
    return NextResponse.redirect(dashboardRedirect(origin, locale, 'stripe', 'error'));
  }
}
