'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Radio } from '@/components/ui/radio';
import type { DeliveryAddressFormData } from '@/lib/account/delivery-address-schema';

type SavedAddress = DeliveryAddressFormData & {
  id: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProfileDetails = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  dni?: string | null;
};

type Props = {
  selectedAddressId: string | null;
  onSelectedAddressChange: (id: string) => void;
  onAddressesLoaded: (id: string | null) => void;
  disabled?: boolean;
};

export default function DeliveryAddressSummary({
  selectedAddressId,
  onSelectedAddressChange,
  onAddressesLoaded,
  disabled = false,
}: Props) {
  const t = useTranslations('Account');
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAddresses = async () => {
      setLoading(true);
      setError(null);
      try {
        const [addressResponse, profileResponse] = await Promise.all([
          fetch('/api/account/addresses', { cache: 'no-store' }),
          fetch('/api/account', { cache: 'no-store' }),
        ]);
        const [addressData, profileData] = await Promise.all([
          addressResponse.json(),
          profileResponse.json(),
        ]);

        if (!addressResponse.ok || !Array.isArray(addressData.addresses)) {
          throw new Error(addressData.error || 'No se pudieron cargar las direcciones guardadas.');
        }
        if (!profileResponse.ok) {
          throw new Error(profileData.error || 'No se pudieron cargar tus datos de entrega.');
        }

        const loadedAddresses = addressData.addresses as SavedAddress[];
        const preferredAddress =
          loadedAddresses.find((address) => address.isDefault) ?? loadedAddresses[0] ?? null;

        if (!cancelled) {
          setAddresses(loadedAddresses);
          setProfile(profileData as ProfileDetails);
          onAddressesLoaded(preferredAddress?.id ?? null);
        }
      } catch (requestError) {
        console.error('Error cargando direcciones de entrega:', requestError);
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'No se pudieron cargar las direcciones guardadas.',
          );
          setAddresses([]);
          onAddressesLoaded(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAddresses();

    return () => {
      cancelled = true;
    };
  }, [onAddressesLoaded]);

  const selectedAddress = addresses.find((address) => address.id === selectedAddressId);

  return (
    <section className="mb-6 rounded-lg border border-border bg-muted/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">{t('checkoutTitle')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('checkoutSubtitle')}</p>
        </div>
        <Link
          href="/account"
          className="text-xs font-semibold text-primary underline hover:text-primary"
        >
          {t('manageAddresses')}
        </Link>
      </div>

      {loading && (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {t('loadingCheckoutAddresses')}
        </p>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="rounded-md border border-warning/25 bg-warning/10 p-3 text-sm text-warning-foreground"
        >
          {error}
        </div>
      )}

      {!loading && !error && addresses.length === 0 && (
        <div className="rounded-md border border-warning/25 bg-warning/10 p-3">
          <p className="text-sm text-warning-foreground">{t('noCheckoutAddresses')}</p>
          <Link
            href="/account"
            className="mt-2 inline-block text-sm font-semibold text-warning-foreground underline"
          >
            {t('newAddress')}
          </Link>
        </div>
      )}

      {!loading && !error && addresses.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="sr-only">{t('selectDeliveryAddress')}</legend>
          {addresses.map((address) => (
            <label
              key={address.id}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                selectedAddressId === address.id
                  ? 'border-primary bg-card ring-1 ring-primary'
                  : 'border-border bg-card hover:border-primary'
              }`}
            >
              <Radio
                type="radio"
                name="deliveryAddressId"
                value={address.id}
                checked={selectedAddressId === address.id}
                onChange={() => onSelectedAddressChange(address.id)}
                disabled={disabled}
                className="mt-1 cursor-pointer accent-primary disabled:cursor-not-allowed"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                  {address.label}
                  {address.isDefault && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">
                      {t('defaultAddress')}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-foreground">
                  {address.shippingStreet} {address.shippingNumber}
                  {address.shippingApartment ? `, ${address.shippingApartment}` : ''}
                </span>
                <span className="block text-sm text-muted-foreground">{locality(address)}</span>
                <span className="block text-sm text-muted-foreground">
                  {address.shippingCountry}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {selectedAddress && profile && (
        <div className="mt-3 border-t border-border pt-3 text-sm text-foreground">
          <p className="font-semibold text-foreground">
            {t('recipient')}: {[profile.firstName, profile.lastName].filter(Boolean).join(' ')}
          </p>
          {profile.phone && <p>{profile.phone}</p>}
          {profile.dni && <p>DNI: {profile.dni}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{t('deliveryQuoteHint')}</p>
        </div>
      )}
    </section>
  );
}

function locality(address: SavedAddress) {
  return [address.shippingCity, address.shippingProvince, address.shippingPostalCode]
    .filter(Boolean)
    .join(', ');
}
