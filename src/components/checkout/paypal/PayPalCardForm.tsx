'use client';

import Script from 'next/script';
import { useCallback } from 'react';

import PayPalCardFields from './PayPalCardFields';
import PayPalPaymentButton from './PayPalPaymentButton';
import PayPalTestData from './PayPalTestData';
import type { PayPalCardFormProps } from './types';
import { usePayPalCardPayment } from './usePayPalCardPayment';

export default function PayPalCardForm({
  amount,
  cartItems,
  onSuccess,
}: PayPalCardFormProps) {
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

      <PayPalCardFields
        session={session}
        onReady={handleFieldsReady}
        onError={handleFieldsError}
      />

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-600">{errorMessage}</p>
        </div>
      )}

      <PayPalPaymentButton
        amount={amount}
        loading={loading}
        ready={ready}
        onClick={submitPayment}
      />
    </div>
  );
}
