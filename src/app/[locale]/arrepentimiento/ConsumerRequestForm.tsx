'use client';

import { usePathname } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function ConsumerRequestForm() {
  const pathname = usePathname();
  const es = pathname.startsWith('/es');
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<FormState>('idle');
  const [requestCode, setRequestCode] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError('');
    setRequestCode('');

    try {
      const response = await fetch('/api/consumer-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          orderNumber: orderNumber.trim(),
          details: details.trim(),
          locale: es ? 'es' : 'en',
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        requestCode?: string;
        error?: string;
      };

      if (!response.ok || !result.success || !result.requestCode) {
        const messages: Record<string, string> = es
          ? {
              rateLimitExceeded:
                'Recibimos demasiadas solicitudes desde esta conexión. Esperá unos minutos e intentá nuevamente.',
              invalidJson: 'La solicitud no es válida. Volvé a intentarlo.',
              invalidData: 'Ingresá un correo válido y revisá los datos.',
            }
          : {
              rateLimitExceeded:
                'Too many requests were sent from this connection. Wait a few minutes and try again.',
              invalidJson: 'The request is invalid. Please try again.',
              invalidData: 'Enter a valid email and check the submitted details.',
            };
        throw new Error(
          (result.error && messages[result.error]) ||
            (es
              ? 'No pudimos registrar la solicitud. Revisá los datos e intentá de nuevo.'
              : 'We could not register your request. Check the details and try again.'),
        );
      }

      setRequestCode(result.requestCode);
      setStatus('success');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : es
            ? 'No se pudo enviar la solicitud.'
            : 'The request could not be submitted.',
      );
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {status === 'success' ? (
        <div
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5"
          role="status"
          aria-live="polite"
        >
          <h2 className="text-lg font-semibold">
            {es ? 'Solicitud registrada' : 'Request registered'}
          </h2>
          <p className="mt-2 text-sm leading-6">
            {es
              ? 'Guardá este código como comprobante de tu solicitud:'
              : 'Keep this reference code as proof of your request:'}
          </p>
          <p className="mt-3 rounded-lg border bg-background px-4 py-3 text-xl font-bold tracking-wide break-all">
            {requestCode}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {es
              ? 'La solicitud quedó guardada. El código no significa que el reembolso ya haya sido ejecutado; el comercio debe verificar el pedido y comunicarte los pasos siguientes por el mismo canal dentro del plazo legal.'
              : 'Your request has been saved. This code does not mean a refund has already been issued; the store must verify the order and communicate the next steps through the same channel within the legal time limit.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label htmlFor="withdrawal-email" className="block text-sm font-medium">
              {es ? 'Correo electrónico de contacto' : 'Contact email'}
              <span className="text-destructive"> *</span>
            </label>
            <input
              id="withdrawal-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="focus-visible:ring-ring min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              {es
                ? 'Lo usaremos para identificar o responder la solicitud. No necesitás iniciar sesión.'
                : 'We will use it to identify or respond to the request. You do not need to sign in.'}
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="withdrawal-order" className="block text-sm font-medium">
              {es ? 'Número de pedido (opcional)' : 'Order number (optional)'}
            </label>
            <input
              id="withdrawal-order"
              name="orderNumber"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={9}
              pattern="[0-9]{1,9}"
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              className="focus-visible:ring-ring min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="withdrawal-details" className="block text-sm font-medium">
              {es ? 'Información adicional (opcional)' : 'Additional information (optional)'}
            </label>
            <textarea
              id="withdrawal-details"
              name="details"
              rows={4}
              maxLength={2000}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              className="focus-visible:ring-ring w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2"
              placeholder={
                es
                  ? 'Por ejemplo, producto o detalle que ayude a localizar la compra.'
                  : 'For example, product or information that helps identify the purchase.'
              }
            />
          </div>
          {status === 'error' && (
            <p className="text-destructive text-sm font-medium" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {status === 'submitting'
              ? es
                ? 'Enviando solicitud…'
                : 'Submitting request…'
              : es
                ? 'Enviar solicitud de arrepentimiento'
                : 'Submit withdrawal request'}
          </button>
        </>
      )}
    </form>
  );
}
