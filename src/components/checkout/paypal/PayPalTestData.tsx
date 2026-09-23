'use client';

import { useState } from 'react';

const testData = {
  cardNumber: '4005519200000004',
  expiration: '12/30',
  cvv: '123',
};

type CopyField = 'card' | 'expiration' | 'cvv' | null;

export default function PayPalTestData() {
  const [copiedField, setCopiedField] = useState<CopyField>(null);

  const copyToClipboard = async (
    value: string,
    field: Exclude<CopyField, null>,
  ) => {
    try {
      await navigator.clipboard.writeText(value);

      setCopiedField(field);

      setTimeout(() => {
        setCopiedField(null);
      }, 1500);
    } catch (error) {
      console.error('No se pudo copiar el dato:', error);
    }
  };

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <h3 className="text-sm font-bold text-blue-900">Datos de prueba</h3>

      <p className="mt-1 text-xs text-blue-700">
        PayPal está configurado en modo Sandbox.
      </p>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Número de tarjeta
            </p>

            <p className="text-sm font-semibold text-gray-800">
              {testData.cardNumber}
            </p>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(testData.cardNumber, 'card')}
            className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
          >
            {copiedField === 'card' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Fecha
            </p>

            <p className="text-sm font-semibold text-gray-800">
              {testData.expiration}
            </p>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(testData.expiration, 'expiration')}
            className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
          >
            {copiedField === 'expiration' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Código de seguridad
            </p>

            <p className="text-sm font-semibold text-gray-800">
              {testData.cvv}
            </p>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(testData.cvv, 'cvv')}
            className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
          >
            {copiedField === 'cvv' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              País
            </p>

            <p className="text-sm font-semibold text-gray-800">
              Estados Unidos
            </p>
          </div>

          <span className="text-[11px] font-semibold text-blue-500">
            Automático
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Código postal
            </p>

            <p className="text-sm font-semibold text-gray-800">94105</p>
          </div>

          <span className="text-[11px] font-semibold text-blue-500">
            Automático
          </span>
        </div>
      </div>
    </div>
  );
}
