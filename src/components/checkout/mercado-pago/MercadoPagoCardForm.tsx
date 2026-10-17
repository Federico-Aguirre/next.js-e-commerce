'use client';

import { loadMercadoPago } from '@mercadopago/sdk-js';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CartItem } from '@/store/useCartStore';
import { useCartStore } from '@/store/useCartStore';

type Props = {
  cartItems: CartItem[];
  cartTotal: number;
};

type CardFormData = {
  paymentMethodId?: string;
  issuerId?: string;
  cardholderEmail?: string;
  amount?: string;
  token?: string;
  installments?: string;
  identificationNumber?: string;
  identificationType?: string;
};

type CardFormInstance = {
  getCardFormData: () => CardFormData;
};

type MercadoPagoInstance = {
  cardForm: (options: Record<string, unknown>) => CardFormInstance;
};

type MercadoPagoConstructor = new (
  publicKey: string,
  options?: { locale?: string },
) => MercadoPagoInstance;

function setNativeValue(id: string, value: string) {
  const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (!element) return;
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export default function MercadoPagoCardForm({ cartItems, cartTotal }: Props) {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);
  const initializedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fillTestBuyer = useCallback(() => {
    setNativeValue('form-checkout__cardholderName', 'APRO');
    setNativeValue('form-checkout__cardholderEmail', 'test@testuser.com');
    setNativeValue('form-checkout__identificationType', 'DNI');
    setNativeValue('form-checkout__identificationNumber', '12345678');
  }, []);

  useEffect(() => {
    if (initializedRef.current || cartItems.length === 0 || cartTotal <= 0) return;
    initializedRef.current = true;

    let cancelled = false;

    async function initializeCardForm() {
      try {
        const configResponse = await fetch('/api/mercadopago/client-config', {
          cache: 'no-store',
        });
        const config = (await configResponse.json()) as {
          publicKey?: string;
          mode?: 'split' | 'standalone';
          message?: string;
        };
        const publicKey = config.publicKey?.trim();
        if (!configResponse.ok || !publicKey) {
          throw new Error(
            config.message || 'Mercado Pago no tiene una clave pública válida para el checkout.',
          );
        }

        await loadMercadoPago();
        if (cancelled) return;

        const MercadoPago = (window as Window & { MercadoPago?: MercadoPagoConstructor })
          .MercadoPago;
        if (!MercadoPago) throw new Error('Mercado Pago no está disponible.');

        const mp = new MercadoPago(publicKey, { locale: 'es-AR' });
        const cardForm = mp.cardForm({
          amount: cartTotal.toFixed(2),
          iframe: true,
          form: {
            id: 'form-checkout',
            cardNumber: { id: 'form-checkout__cardNumber', placeholder: 'Número de tarjeta' },
            expirationDate: { id: 'form-checkout__expirationDate', placeholder: 'MM/YY' },
            securityCode: { id: 'form-checkout__securityCode', placeholder: 'CVV' },
            cardholderName: { id: 'form-checkout__cardholderName', placeholder: 'Titular' },
            issuer: { id: 'form-checkout__issuer', placeholder: 'Banco emisor' },
            installments: { id: 'form-checkout__installments', placeholder: 'Cuotas' },
            identificationType: {
              id: 'form-checkout__identificationType',
              placeholder: 'Tipo de documento',
            },
            identificationNumber: {
              id: 'form-checkout__identificationNumber',
              placeholder: 'Número de documento',
            },
            cardholderEmail: { id: 'form-checkout__cardholderEmail', placeholder: 'Email' },
          },
          callbacks: {
            onFormMounted: (error: unknown) => {
              if (error) {
                console.error('Mercado Pago CardForm mount error:', error);
                setErrorMessage('No se pudo inicializar el formulario de Mercado Pago.');
                return;
              }
              setReady(true);
            },
            onSubmit: async (event: Event) => {
              event.preventDefault();
              if (loading) return;

              setLoading(true);
              setErrorMessage(null);

              try {
                const data = cardForm.getCardFormData();
                const token = String(data.token || '').trim();
                const paymentMethodId = String(data.paymentMethodId || '').trim();
                const issuerId = String(data.issuerId || '').trim();
                const email = String(data.cardholderEmail || '').trim();
                const identificationType = String(data.identificationType || '').trim();
                const identificationNumber = String(data.identificationNumber || '').trim();
                const installments = Number(data.installments || 1);

                if (
                  !token ||
                  !paymentMethodId ||
                  !email ||
                  !identificationType ||
                  !identificationNumber
                ) {
                  throw new Error(
                    'Mercado Pago no pudo obtener todos los datos necesarios de la tarjeta.',
                  );
                }

                const reservationResponse = await fetch('/api/checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    items: cartItems,
                    paymentMethod: 'mercadopago-card',
                    checkoutKey: crypto.randomUUID(),
                  }),
                });
                const reservation = await reservationResponse.json();

                if (!reservationResponse.ok || !reservation.orderId) {
                  throw new Error(
                    reservation.error || reservation.message || 'No se pudo reservar el stock.',
                  );
                }

                localStorage.setItem('last_pending_order_id', reservation.orderId);

                const response = await fetch('/api/process-payment', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: reservation.orderId,
                    token,
                    payment_method_id: paymentMethodId,
                    issuer_id: issuerId || undefined,
                    description: 'Compra desde carrito',
                    email,
                    docType: identificationType,
                    docNumber: identificationNumber,
                    installments,
                  }),
                });
                const result = await response.json();

                if (!response.ok) {
                  const requestId = result.requestId
                    ? ` (Mercado Pago requestId: ${result.requestId})`
                    : '';
                  const mpStatus = result.mercadoPagoStatus
                    ? ` [MP HTTP ${result.mercadoPagoStatus}]`
                    : '';
                  const mpCode = result.mercadoPagoError ? ` [${result.mercadoPagoError}]` : '';
                  const mpCauses =
                    Array.isArray(result.mercadoPagoCauses) && result.mercadoPagoCauses.length
                      ? ` ${JSON.stringify(result.mercadoPagoCauses)}`
                      : '';
                  throw new Error(
                    `${result.message || result.error || 'No se pudo procesar el pago.'}${mpStatus}${mpCode}${mpCauses}${requestId}`,
                  );
                }

                if (result.status !== 'approved' || result.status_detail !== 'accredited') {
                  throw new Error(
                    `Estado del pago: ${result.status || 'desconocido'} (${result.status_detail || 'sin detalle'})`,
                  );
                }

                if (!result.orderId) {
                  throw new Error('El pago fue aprobado pero no se confirmó la orden local.');
                }

                localStorage.removeItem('last_pending_order_id');
                clearCart();
                alert('¡Compra realizada con éxito!');
                router.replace('/historial');
              } catch (error) {
                console.error('Error procesando CardForm de Mercado Pago:', error);
                const message =
                  error instanceof Error ? error.message : 'No se pudo procesar el pago.';
                setErrorMessage(message);
                alert(`Error: ${message}`);
              } finally {
                setLoading(false);
              }
            },
            onFetching: () => () => undefined,
          },
        });
      } catch (error) {
        console.error('Error inicializando CardForm de Mercado Pago:', error);
        setErrorMessage(
          error instanceof Error ? error.message : 'No se pudo iniciar Mercado Pago.',
        );
        initializedRef.current = false;
      }
    }

    void initializeCardForm();

    return () => {
      cancelled = true;
    };
  }, [cartItems, cartTotal, clearCart, loading, router]);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={fillTestBuyer}
        className="w-full rounded-lg border border-yellow-300 bg-yellow-100 px-4 py-2.5 text-sm font-semibold text-yellow-800 hover:bg-yellow-200"
      >
        Completar titular, email y DNI de prueba
      </button>

      <form id="form-checkout" className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Número de Tarjeta
          </label>
          <div
            id="form-checkout__cardNumber"
            className="h-11 rounded-md border border-gray-300 bg-white px-3 py-2"
          />
        </div>

        <div>
          <label
            htmlFor="form-checkout__cardholderName"
            className="mb-1.5 block text-sm font-semibold text-gray-700"
          >
            Nombre del Titular
          </label>
          <input
            id="form-checkout__cardholderName"
            type="text"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Vencimiento</label>
            <div
              id="form-checkout__expirationDate"
              className="h-11 rounded-md border border-gray-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">CVV</label>
            <div
              id="form-checkout__securityCode"
              className="h-11 rounded-md border border-gray-300 bg-white px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="form-checkout__issuer"
              className="mb-1.5 block text-sm font-semibold text-gray-700"
            >
              Banco emisor
            </label>
            <select
              id="form-checkout__issuer"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
            />
          </div>
          <div>
            <label
              htmlFor="form-checkout__installments"
              className="mb-1.5 block text-sm font-semibold text-gray-700"
            >
              Cuotas
            </label>
            <select
              id="form-checkout__installments"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="form-checkout__cardholderEmail"
            className="mb-1.5 block text-sm font-semibold text-gray-700"
          >
            Email
          </label>
          <input
            id="form-checkout__cardholderEmail"
            type="email"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
          />
        </div>

        <div className="grid grid-cols-[35%_65%] gap-3">
          <div>
            <label
              htmlFor="form-checkout__identificationType"
              className="mb-1.5 block text-sm font-semibold text-gray-700"
            >
              Tipo Doc
            </label>
            <select
              id="form-checkout__identificationType"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
            />
          </div>
          <div>
            <label
              htmlFor="form-checkout__identificationNumber"
              className="mb-1.5 block text-sm font-semibold text-gray-700"
            >
              Número Doc
            </label>
            <input
              id="form-checkout__identificationNumber"
              type="text"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
            />
          </div>
        </div>

        {errorMessage && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        <button
          id="form-checkout__submit"
          type="submit"
          disabled={!ready || loading || cartItems.length === 0}
          className="mt-2 w-full rounded-lg bg-sky-500 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Procesando...' : ready ? 'Realizar Compra' : 'Cargando Mercado Pago...'}
        </button>
      </form>
    </div>
  );
}
