'use client';

import Script from 'next/script';
import { useCallback } from 'react';
import { STORE_BASE_CURRENCY } from '@/lib/currency/currencies';
import { calculateTaxBreakdown } from '@/lib/tax/tax-calculation';
import { useCurrency } from '@/providers/CurrencyProvider';
import PayPalCardFields from './PayPalCardFields';
import PayPalPaymentButton from './PayPalPaymentButton';
import PayPalTestData from './PayPalTestData';
import type { PayPalCardFormProps } from './types';
import { usePayPalCardPayment } from './usePayPalCardPayment';

export default function PayPalCardForm({ cartItems, onSuccess }: PayPalCardFormProps) {
  const { convertAmount, ratesReady, taxProfile } = useCurrency();
  const estimatedTotalUsd = Number(
    cartItems
      .reduce((total, item) => {
        const taxableUnitPrice = calculateTaxBreakdown(
          item.price,
          taxProfile?.rate,
          STORE_BASE_CURRENCY,
          taxProfile?.calculationMethod,
        ).total;
        const convertedUnitPrice = convertAmount(taxableUnitPrice, STORE_BASE_CURRENCY, 'USD');
        return total + (convertedUnitPrice ?? 0) * item.quantity;
      }, 0)
      .toFixed(2),
  );
  const quoteAvailable =
    cartItems.every(
      (item) =>
        convertAmount(
          calculateTaxBreakdown(
            item.price,
            taxProfile?.rate,
            STORE_BASE_CURRENCY,
            taxProfile?.calculationMethod,
          ).total,
          STORE_BASE_CURRENCY,
          'USD',
        ) !== null,
    ) &&
    (STORE_BASE_CURRENCY === 'USD' || ratesReady);

  const {
    scriptUrl,
    loadSDK,
    handleSDKError,
    session,
    ready,
    setReady,
    loading,
    errorMessage,
    setErrorMessage,
    submitPayment,
  } = usePayPalCardPayment({
    cartItems,
    onSuccess,
  });

  const handleFieldsReady = useCallback(() => {
    setReady(true);
  }, [setReady]);

  const handleFieldsError = useCallback(
    (message: string) => {
      setReady(false);
      setErrorMessage(message);
    },
    [setReady, setErrorMessage],
  );

  return (
    <div className="space-y-5">
      <Script
        src={scriptUrl}
        strategy="afterInteractive"
        onLoad={loadSDK}
        onError={handleSDKError}
      />

      <PayPalTestData />

      <PayPalCardFields session={session} onReady={handleFieldsReady} onError={handleFieldsError} />

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-600">{errorMessage}</p>
        </div>
      )}

      {ratesReady && !quoteAvailable && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          No se pudo obtener una cotización para mostrar el importe en USD. Revisá la conexión e
          intentá nuevamente.
        </p>
      )}

      <PayPalPaymentButton
        amount={estimatedTotalUsd}
        loading={loading}
        ready={ready && quoteAvailable}
        onClick={submitPayment}
      />
    </div>
  );
}
