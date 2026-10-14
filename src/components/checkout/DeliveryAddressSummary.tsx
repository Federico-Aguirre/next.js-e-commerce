'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AccountFormData } from '@/lib/account/accountSchema';

type DeliveryAddress = Partial<AccountFormData>;

const requiredFields: (keyof AccountFormData)[] = [
  'firstName',
  'lastName',
  'phone',
  'shippingStreet',
  'shippingNumber',
  'shippingCity',
  'shippingProvince',
  'shippingPostalCode',
  'shippingCountry',
];

export default function DeliveryAddressSummary() {
  const [address, setAddress] = useState<DeliveryAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAddress = async () => {
      try {
        const response = await fetch('/api/account', { cache: 'no-store' });

        if (!response.ok) {
          throw new Error('No se pudo cargar la dirección de entrega.');
        }

        const data = (await response.json()) as DeliveryAddress;

        if (!cancelled) {
          setAddress(data);
        }
      } catch (requestError) {
        console.error('Error cargando la dirección de entrega:', requestError);

        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAddress();

    return () => {
      cancelled = true;
    };
  }, []);

  const complete = address && requiredFields.every((field) => String(address[field] ?? '').trim());

  if (loading) {
    return (
      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        Cargando dirección de entrega...
      </div>
    );
  }

  if (error || !complete || !address) {
    return (
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-sm font-bold text-amber-900">Dirección de entrega</h3>
        <p className="mt-1 text-sm text-amber-800">
          Completá tus datos de entrega antes de realizar el pedido.
        </p>
        <Link
          href="/account"
          className="mt-3 inline-block text-sm font-bold text-amber-900 underline"
        >
          Completar datos de entrega
        </Link>
      </div>
    );
  }

  const streetLine = [address.shippingStreet, address.shippingNumber].filter(Boolean).join(' ');
  const apartmentLine = address.shippingApartment?.trim();
  const localityLine = [address.shippingCity, address.shippingProvince, address.shippingPostalCode]
    .filter(Boolean)
    .join(', ');

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold text-gray-900">Dirección de entrega</h3>
        <Link href="/account" className="text-xs font-semibold text-sky-700 hover:underline">
          Editar
        </Link>
      </div>

      <div className="space-y-1 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">
          {address.firstName} {address.lastName}
        </p>
        <p>{address.phone}</p>
        <p>{streetLine}</p>
        {apartmentLine && <p>{apartmentLine}</p>}
        <p>{localityLine}</p>
        <p>{address.shippingCountry}</p>
        {address.dni && <p>DNI: {address.dni}</p>}
      </div>
    </section>
  );
}
