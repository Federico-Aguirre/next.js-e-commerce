import 'server-only';
import Stripe from 'stripe';
import {
  getStorePaymentConnection,
  saveStorePaymentConnection,
} from '@/lib/payments/store-connections';

export async function reconcilePendingStripeConnection() {
  const connection = await getStorePaymentConnection('STRIPE');
  if (!connection) return null;
  if (connection.status === 'ACTIVE' || connection.status === 'CLOSED') {
    return connection.status;
  }
  if (connection.status !== 'PENDING' && connection.status !== 'REQUIRES_ACTION') {
    return connection.status;
  }

  const secretKey = process.env.DEVELOPER_STRIPE_SECRET_KEY?.trim();
  const accountId = connection.externalAccountId?.trim();
  if (!secretKey?.startsWith('sk_test_') || !accountId) {
    return connection.status;
  }

  try {
    const stripe = new Stripe(secretKey);
    const account = await stripe.v2.core.accounts.retrieve(accountId, {
      include: ['configuration.recipient', 'requirements'],
    });
    const transferStatus =
      account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
    const payoutStatus =
      account.configuration?.recipient?.capabilities?.stripe_balance?.payouts?.status;
    const requirements = account.requirements?.entries ?? [];
    const active =
      !account.livemode &&
      !account.closed &&
      transferStatus === 'active' &&
      requirements.length === 0;
    const nextStatus = account.closed ? 'CLOSED' : active ? 'ACTIVE' : 'REQUIRES_ACTION';

    await saveStorePaymentConnection({
      provider: 'STRIPE',
      externalAccountId: account.id,
      status: nextStatus,
      metadata: {
        sandbox: true,
        dashboard: account.dashboard ?? 'express',
        api: 'v2',
        transferStatus: transferStatus ?? 'unknown',
        payoutStatus: payoutStatus ?? 'unknown',
        pendingRequirements: requirements.length,
        verification: 'stripe_v2_account',
      },
    });

    return nextStatus;
  } catch (error) {
    console.error('No se pudo reconciliar el onboarding sandbox de Stripe.', error);
    return connection.status;
  }
}
