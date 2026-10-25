'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import ProPlanMercadoPagoPayment from './ProPlanMercadoPagoPayment';
import ProPlanPayPalPayment from './ProPlanPayPalPayment';
import ProPlanStripePayment from './ProPlanStripePayment';

type ProviderState = {
  enabled: boolean;
  currency: 'ARS' | 'USD';
  amount?: number | null;
  publicKey?: string | null;
  reason?: string | null;
};
type PaymentOptions = {
  amountARS: number;
  storefrontOpen: boolean;
  proActive: boolean;
  paymentPending: boolean;
  pendingPaymentProvider: 'STRIPE' | 'PAYPAL' | 'MERCADOPAGO' | null;
  pendingPaymentAttemptId: string | null;
  pendingSavedPaymentMethodId: string | null;
  providers: {
    STRIPE: ProviderState;
    PAYPAL: ProviderState;
    MERCADOPAGO: ProviderState;
  };
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const providerNames = {
  STRIPE: 'Stripe',
  PAYPAL: 'PayPal',
  MERCADOPAGO: 'Mercado Pago',
} as const;

export default function ProPlanPaymentDialog({ open, onClose, onSuccess }: Props) {
  const t = useTranslations('SubscriptionManager');
  const [options, setOptions] = useState<PaymentOptions | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'STRIPE' | 'PAYPAL' | 'MERCADOPAGO'>(
    'STRIPE',
  );
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetch('/api/dashboard/pro-payment/options', { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json()) as PaymentOptions & { error?: string };
        if (!response.ok)
          throw new Error(data.error || 'No se pudo consultar los métodos de pago.');
        return data;
      })
      .then((data) => {
        if (!active) return;
        setOptionsError(null);
        setOptions(data);
        const preferred =
          data.paymentPending &&
          data.pendingPaymentProvider &&
          data.providers[data.pendingPaymentProvider].enabled
            ? data.pendingPaymentProvider
            : (['STRIPE', 'PAYPAL', 'MERCADOPAGO'] as const).find(
                (provider) => data.providers[provider].enabled,
              );
        if (preferred) setSelectedProvider(preferred);
      })
      .catch((error) => {
        if (active) {
          setOptions(null);
          setOptionsError(
            error instanceof Error ? error.message : 'No se pudieron cargar los métodos de pago.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [open]);

  function closeDialog() {
    setOptions(null);
    setOptionsError(null);
    onClose();
  }

  function handleSuccess() {
    setOptions(null);
    setOptionsError(null);
    onSuccess();
  }

  if (!open) return null;

  const providerUnavailable = (provider: string) => {
    if (provider === 'MERCADOPAGO') {
      return t('providerMercadoPagoSetup');
    }
    if (provider === 'PAYPAL') {
      return t('providerPayPalSetup');
    }
    return t('providerStripeSetup');
  };

  const current = options?.providers[selectedProvider];
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-payment-dialog-title"
        className="my-auto w-full max-w-2xl rounded-2xl border bg-background p-5 text-foreground shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {t('paymentDialogEyebrow')}
            </p>
            <h2 id="pro-payment-dialog-title" className="mt-2 text-xl font-semibold">
              {t('paymentDialogTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('paymentDialogDescription')}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full bg-background"
            onClick={closeDialog}
            aria-label={t('paymentClose')}
          >
            ✕
          </Button>
        </div>

        {optionsError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
          >
            {optionsError}
          </p>
        )}
        {!options && !optionsError && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Consultando métodos de pago…
          </p>
        )}

        {options && (
          <>
            {!options.storefrontOpen && (
              <p role="alert" className="mt-4 rounded-lg border p-3 text-sm">
                {t('paymentStoreClosed')}
              </p>
            )}
            {options.proActive && (
              <p role="status" className="mt-4 rounded-lg border p-3 text-sm">
                {t('proAlreadyActive')}
              </p>
            )}
            {options.paymentPending && (
              <p role="status" className="mt-4 rounded-lg border p-3 text-sm">
                {t('paymentPending')} Se reanudará con{' '}
                {options.pendingPaymentProvider
                  ? providerNames[options.pendingPaymentProvider]
                  : 'el proveedor anterior'}
                .
              </p>
            )}

            <fieldset
              className="mt-5 space-y-2"
              disabled={
                !options.storefrontOpen ||
                options.proActive ||
                (options.paymentPending && !options.pendingPaymentAttemptId)
              }
            >
              <legend className="mb-2 text-sm font-semibold">{t('paymentProvider')}</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(['STRIPE', 'PAYPAL', 'MERCADOPAGO'] as const).map((provider) => {
                  const state = options.providers[provider];
                  const chosen = selectedProvider === provider;
                  const pendingForOtherProvider =
                    options.paymentPending && options.pendingPaymentProvider !== provider;
                  return (
                    <button
                      key={provider}
                      type="button"
                      aria-pressed={chosen}
                      disabled={!state.enabled || pendingForOtherProvider}
                      onClick={() => setSelectedProvider(provider)}
                      className={`rounded-xl border p-3 text-left transition ${chosen ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border'} ${state.enabled ? '' : 'cursor-not-allowed opacity-60'}`}
                    >
                      <span className="block font-semibold">{providerNames[provider]}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {state.enabled
                          ? provider === 'PAYPAL'
                            ? t('providerPayPalCurrency')
                            : t('providerStripeCurrency')
                          : t('providerUnavailable')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {current && !current.enabled && (
              <p className="mt-3 rounded-lg border p-3 text-sm text-muted-foreground">
                {providerUnavailable(selectedProvider)}
              </p>
            )}
            {!options.paymentPending && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {(['STRIPE', 'PAYPAL', 'MERCADOPAGO'] as const)
                  .filter((provider) => !options.providers[provider].enabled)
                  .map((provider) => (
                    <p key={provider}>
                      <strong>{providerNames[provider]}:</strong> {providerUnavailable(provider)}
                    </p>
                  ))}
              </div>
            )}
            {options.paymentPending && !options.pendingPaymentAttemptId && (
              <p role="alert" className="mt-3 rounded-lg border p-3 text-sm">
                El intento pendiente no se puede reanudar automáticamente desde este panel. No
                inicies otro pago; contactá al soporte de la plataforma para verificarlo.
              </p>
            )}

            {current?.enabled &&
              options.storefrontOpen &&
              !options.proActive &&
              (!options.paymentPending ||
                Boolean(
                  options.pendingPaymentAttemptId &&
                  selectedProvider === options.pendingPaymentProvider,
                )) && (
                <div className="mt-5 space-y-4">
                  {selectedProvider === 'STRIPE' && (
                    <ProPlanStripePayment
                      existingAttemptId={options.pendingPaymentAttemptId}
                      existingSavedPaymentMethodId={options.pendingSavedPaymentMethodId}
                      onSuccess={handleSuccess}
                    />
                  )}
                  {selectedProvider === 'PAYPAL' && (
                    <ProPlanPayPalPayment
                      existingAttemptId={options.pendingPaymentAttemptId}
                      existingSavedPaymentMethodId={options.pendingSavedPaymentMethodId}
                      onSuccess={handleSuccess}
                    />
                  )}
                  {selectedProvider === 'MERCADOPAGO' && current.publicKey && (
                    <ProPlanMercadoPagoPayment
                      existingAttemptId={options.pendingPaymentAttemptId}
                      existingSavedPaymentMethodId={options.pendingSavedPaymentMethodId}
                      publicKey={current.publicKey}
                      onSuccess={handleSuccess}
                    />
                  )}
                  {selectedProvider === 'PAYPAL' && current.amount != null && (
                    <p className="text-xs text-muted-foreground">
                      Cotización orientativa: ARS 75.000 ≈{' '}
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(current.amount)}{' '}
                      USD. El importe exacto se valida en el servidor al iniciar el pago.
                    </p>
                  )}
                </div>
              )}
          </>
        )}

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" onClick={closeDialog}>
            {t('paymentCancel')}
          </Button>
        </div>
      </section>
    </div>
  );
}
