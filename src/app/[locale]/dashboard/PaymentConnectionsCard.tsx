'use client';

import { useLocale, useTranslations } from 'next-intl';

type ConnectionStatus = string | null;

type Provider = 'mercadopago' | 'paypal' | 'stripe';

const PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: 'mercadopago', label: 'Mercado Pago' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'stripe', label: 'Stripe' },
];

function statusKind(status: ConnectionStatus) {
  if (status === 'ACTIVE' || status === 'CONNECTED') return 'connected';
  if (status === 'PENDING') return 'pending';
  if (status === 'REQUIRES_ACTION') return 'requiresAction';
  if (status === 'CLOSED' || status === 'REVOKED') return 'blocked';
  return status ? 'error' : 'notConnected';
}

export default function PaymentConnectionsCard({
  connections,
}: {
  connections: {
    mercadoPago: ConnectionStatus;
    paypal: ConnectionStatus;
    stripe: ConnectionStatus;
    stripeError: string | null;
  };
}) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const statuses: Record<Provider, ConnectionStatus> = {
    mercadopago: connections.mercadoPago,
    paypal: connections.paypal,
    stripe: connections.stripe,
  };

  return (
    <section className="rounded-2xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('paymentConnections')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('paymentConnectionsSubtitle')}</p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold">SANDBOX</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {PROVIDERS.map((provider) => {
          const kind = statusKind(statuses[provider.id]);
          const connected = kind === 'connected';
          const href = `/api/platform/payments/${provider.id}/connect?locale=${encodeURIComponent(locale)}`;

          return (
            <article key={provider.id} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{provider.label}</p>
                <span className="text-xs font-medium text-muted-foreground">
                  {t(`paymentConnectionStatus.${kind}`)}
                </span>
              </div>

              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {provider.id === 'stripe' && !connected && connections.stripeError
                  ? connections.stripeError
                  : connected
                    ? t('paymentConnectionProtected')
                    : t('paymentConnectionRequired')}
              </p>

              {!connected && (
                <div className="mt-4 flex flex-col gap-2">
                  {provider.id === 'stripe' && (
                    <a
                      href="https://dashboard.stripe.com/settings/connect/platform-profile"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium underline underline-offset-4"
                    >
                      {t('stripePlatformProfile')}
                    </a>
                  )}
                  <a
                    href={href}
                    className="inline-flex w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    {kind === 'notConnected'
                      ? t('connectPaymentProvider', { provider: provider.label })
                      : t('continuePaymentProvider', { provider: provider.label })}
                  </a>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        {t('paymentConnectionNoDisconnect')}
      </p>
    </section>
  );
}
