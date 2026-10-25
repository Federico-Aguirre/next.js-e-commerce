'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

const testCards = [{ label: 'Visa principal', number: '4012888888881881' }] as const;

const expiration = '12/30';
const cvv = '123';

export default function PayPalTestData() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (process.env.NODE_ENV !== 'development') return null;

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
    <div className="rounded-xl border border-paypal/20 bg-accent p-4">
      <h3 className="text-sm font-bold text-primary">Datos de prueba</h3>
      <p className="mt-1 text-xs text-primary">PayPal está configurado en modo Sandbox.</p>
      <div className="mt-3 space-y-2">
        {testCards.map((card, index) => {
          const field = `card-${index}`;
          return (
            <div
              key={card.number}
              className="flex items-center justify-between gap-3 rounded-lg border border-paypal/20 bg-card px-3 py-2"
            >
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {card.label}
                </p>
                <p className="text-sm font-semibold text-foreground">{card.number}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => copyToClipboard(card.number, field)}
                className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
              >
                {copiedField === field ? '✓ Copiado' : 'Copiar'}
              </Button>
            </div>
          );
        })}

        <div className="flex items-center justify-between gap-3 rounded-lg border border-paypal/20 bg-card px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Fecha
            </p>
            <p className="text-sm font-semibold text-foreground">{expiration}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => copyToClipboard(expiration, 'expiration')}
            className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
          >
            {copiedField === 'expiration' ? '✓ Copiado' : 'Copiar'}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-paypal/20 bg-card px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Código de seguridad
            </p>
            <p className="text-sm font-semibold text-foreground">{cvv}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => copyToClipboard(cvv, 'cvv')}
            className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
          >
            {copiedField === 'cvv' ? '✓ Copiado' : 'Copiar'}
          </Button>
        </div>

        <div className="rounded-lg border border-paypal/20 bg-card px-3 py-2 text-xs text-muted-foreground">
          Billing sandbox: Estados Unidos · CP 94105
        </div>
      </div>
    </div>
  );
}
