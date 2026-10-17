'use client';

import { useState } from 'react';

const testCards = [{ label: 'Visa principal', number: '4012888888881881' }] as const;

const expiration = '12/30';
const cvv = '123';

export default function PayPalTestData() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch (error) {
      console.error('No se pudo copiar el dato:', error);
    }
  };

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <h3 className="text-sm font-bold text-blue-900">Datos de prueba</h3>
      <p className="mt-1 text-xs text-blue-700">PayPal está configurado en modo Sandbox.</p>
      <div className="mt-3 space-y-2">
        {testCards.map((card, index) => {
          const field = `card-${index}`;
          return (
            <div
              key={card.number}
              className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2"
            >
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                  {card.label}
                </p>
                <p className="text-sm font-semibold text-gray-800">{card.number}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(card.number, field)}
                className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
              >
                {copiedField === field ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          );
        })}

        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">Fecha</p>
            <p className="text-sm font-semibold text-gray-800">{expiration}</p>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(expiration, 'expiration')}
            className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
          >
            {copiedField === 'expiration' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
              Código de seguridad
            </p>
            <p className="text-sm font-semibold text-gray-800">{cvv}</p>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(cvv, 'cvv')}
            className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
          >
            {copiedField === 'cvv' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs text-gray-600">
          Billing sandbox: Estados Unidos · CP 94105
        </div>
      </div>
    </div>
  );
}
