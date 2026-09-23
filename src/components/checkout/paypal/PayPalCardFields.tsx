'use client';

import { useEffect, useRef } from 'react';

import type { PayPalCardSession } from './types';

type PayPalCardFieldsProps = {
  session: PayPalCardSession | null;
  onReady: () => void;
  onError: (message: string) => void;
};

export default function PayPalCardFields({
  session,
  onReady,
  onError,
}: PayPalCardFieldsProps) {
  const numberRef = useRef<HTMLDivElement>(null);
  const expiryRef = useRef<HTMLDivElement>(null);
  const cvvRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (
      !session ||
      !numberRef.current ||
      !expiryRef.current ||
      !cvvRef.current ||
      mountedRef.current
    ) {
      return;
    }

    mountedRef.current = true;

    try {
      const numberField = session.createCardFieldsComponent({
        type: 'number',
        placeholder: 'Número de tarjeta',
      });

      const expiryField = session.createCardFieldsComponent({
        type: 'expiry',
        placeholder: 'MM/AA',
      });

      const cvvField = session.createCardFieldsComponent({
        type: 'cvv',
        placeholder: 'CVV',
      });

      numberRef.current.appendChild(numberField);
      expiryRef.current.appendChild(expiryField);
      cvvRef.current.appendChild(cvvField);

      onReady();
    } catch (error: unknown) {
      mountedRef.current = false;

      console.error('❌ Error montando PayPal Card Fields:', error);

      onError(
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar los campos de tarjeta de PayPal.',
      );
    }

    return () => {
      /*
       * No eliminamos los iframes de PayPal durante el cleanup
       * porque Next/React puede ejecutar los effects dos veces
       * en desarrollo (Strict Mode).
       */
    };
  }, [session, onReady, onError]);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">
          Número de tarjeta
        </label>

        <div
          ref={numberRef}
          className="h-11 w-full rounded-md border border-gray-300 bg-white px-3"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Fecha de vencimiento
          </label>

          <div
            ref={expiryRef}
            className="h-11 w-full rounded-md border border-gray-300 bg-white px-3"
          />
        </div>

        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Código de seguridad
          </label>

          <div
            ref={cvvRef}
            className="h-11 w-full rounded-md border border-gray-300 bg-white px-3"
          />
        </div>
      </div>
    </div>
  );
}
