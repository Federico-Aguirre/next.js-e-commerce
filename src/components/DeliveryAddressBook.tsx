'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  deliveryAddressSchema,
  type DeliveryAddressFormData,
} from '@/lib/account/delivery-address-schema';

type SavedAddress = DeliveryAddressFormData & {
  id: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  refreshSignal: number;
  onDefaultAddressChanged: () => void;
};

const emptyAddress: DeliveryAddressFormData = {
  label: 'Casa',
  shippingStreet: '',
  shippingNumber: '',
  shippingApartment: '',
  shippingCity: '',
  shippingProvince: '',
  shippingPostalCode: '',
  shippingCountry: 'Argentina',
};

function addressFormValues(address: SavedAddress): DeliveryAddressFormData {
  return {
    label: address.label,
    shippingStreet: address.shippingStreet,
    shippingNumber: address.shippingNumber,
    shippingApartment: address.shippingApartment ?? '',
    shippingCity: address.shippingCity,
    shippingProvince: address.shippingProvince,
    shippingPostalCode: address.shippingPostalCode,
    shippingCountry: address.shippingCountry,
  };
}

export default function DeliveryAddressBook({ refreshSignal, onDefaultAddressChanged }: Props) {
  const t = useTranslations('Account');
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DeliveryAddressFormData>(emptyAddress);
  const [makeDefault, setMakeDefault] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/account/addresses', { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as {
        addresses?: SavedAddress[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || t('addressLoadError'));
      setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
      setError('');
    } catch (requestError) {
      console.error('No se pudieron cargar las direcciones guardadas.', requestError);
      setError(requestError instanceof Error ? requestError.message : t('addressLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses, refreshSignal]);

  const openNewForm = () => {
    setEditingId(null);
    setForm({ ...emptyAddress, label: addresses.length === 0 ? 'Casa' : 'Trabajo' });
    setMakeDefault(addresses.length === 0);
    setMessage('');
    setError('');
    setFormOpen(true);
  };

  const openEditForm = (address: SavedAddress) => {
    setEditingId(address.id);
    setForm(addressFormValues(address));
    setMakeDefault(address.isDefault);
    setMessage('');
    setError('');
    setFormOpen(true);
  };

  const cancelForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyAddress);
    setMakeDefault(false);
    setError('');
  };

  const handleFieldChange = (field: keyof DeliveryAddressFormData, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setMessage('');
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const result = deliveryAddressSchema.safeParse(form);
    if (!result.success) {
      setError(t('addressValidationError'));
      return;
    }

    setSaving(true);
    const currentAddress = addresses.find((address) => address.id === editingId);
    const shouldRefreshProfile =
      makeDefault || Boolean(currentAddress?.isDefault) || (!editingId && addresses.length === 0);

    try {
      const response = await fetch(
        editingId
          ? `/api/account/addresses/${encodeURIComponent(editingId)}`
          : '/api/account/addresses',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...result.data, isDefault: makeDefault }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        address?: SavedAddress;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || t('addressSaveError'));

      setMessage(t('addressSaved'));
      setFormOpen(false);
      setEditingId(null);
      await loadAddresses();
      if (shouldRefreshProfile) onDefaultAddressChanged();
    } catch (requestError) {
      console.error('No se pudo guardar la dirección de entrega.', requestError);
      setError(requestError instanceof Error ? requestError.message : t('addressSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (address: SavedAddress) => {
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/account/addresses/${encodeURIComponent(address.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addressFormValues(address), isDefault: true }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || t('addressSaveError'));
      setMessage(t('defaultAddressUpdated'));
      await loadAddresses();
      onDefaultAddressChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('addressSaveError'));
    }
  };

  const handleDelete = async (address: SavedAddress) => {
    if (!window.confirm(t('confirmDeleteAddress', { label: address.label }))) return;

    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/account/addresses/${encodeURIComponent(address.id)}`, {
        method: 'DELETE',
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || t('addressDeleteError'));
      setMessage(t('addressDeleted'));
      await loadAddresses();
      if (address.isDefault) onDefaultAddressChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('addressDeleteError'));
    }
  };

  return (
    <section
      className="mt-8 border-t border-border pt-8"
      aria-labelledby="delivery-address-book-title"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="delivery-address-book-title" className="text-lg font-semibold text-foreground">
            {t('addressesTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('addressesSubtitle')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={formOpen ? cancelForm : openNewForm}
          className="rounded-lg"
        >
          {formOpen ? t('cancel') : t('newAddress')}
        </Button>
      </div>

      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('loadingAddresses')}
        </p>
      )}

      {!loading && addresses.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t('noAddresses')}
        </p>
      )}

      <div className="space-y-3">
        {addresses.map((address) => (
          <Card as="article" key={address.id} variant="flat" padding="default" className="gap-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{address.label}</h3>
                  {address.isDefault && (
                    <span className="rounded-full bg-accent px-2 py-1 text-xs font-semibold text-primary">
                      {t('defaultAddress')}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-foreground">
                  {address.shippingStreet} {address.shippingNumber}
                  {address.shippingApartment ? `, ${address.shippingApartment}` : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[address.shippingCity, address.shippingProvince, address.shippingPostalCode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p className="text-sm text-muted-foreground">{address.shippingCountry}</p>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => openEditForm(address)}
                  className="h-auto px-0 py-1"
                >
                  {t('editAddress')}
                </Button>
                {!address.isDefault && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => void handleSetDefault(address)}
                    className="h-auto px-0 py-1"
                  >
                    {t('setDefault')}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => void handleDelete(address)}
                  className="h-auto px-0 py-1 text-destructive hover:text-destructive"
                >
                  {t('deleteAddress')}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-4 rounded-lg border border-primary/25 bg-accent/40 p-4"
        >
          <h3 className="font-semibold text-foreground">
            {editingId ? t('editAddress') : t('newAddress')}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">
                {t('addressLabel')}
              </span>
              <Input
                value={form.label}
                onChange={(event) => handleFieldChange('label', event.target.value)}
                required
                minLength={2}
                maxLength={60}
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                placeholder={t('addressLabelPlaceholder')}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">
                {t('street')} *
              </span>
              <Input
                value={form.shippingStreet}
                onChange={(event) => handleFieldChange('shippingStreet', event.target.value)}
                required
                maxLength={120}
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">
                {t('number')} *
              </span>
              <Input
                value={form.shippingNumber}
                onChange={(event) => handleFieldChange('shippingNumber', event.target.value)}
                required
                maxLength={20}
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">
                {t('apartment')}
              </span>
              <Input
                value={form.shippingApartment ?? ''}
                onChange={(event) => handleFieldChange('shippingApartment', event.target.value)}
                maxLength={50}
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">
                {t('city')} *
              </span>
              <Input
                value={form.shippingCity}
                onChange={(event) => handleFieldChange('shippingCity', event.target.value)}
                required
                maxLength={80}
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">
                {t('province')} *
              </span>
              <Input
                value={form.shippingProvince}
                onChange={(event) => handleFieldChange('shippingProvince', event.target.value)}
                required
                maxLength={80}
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">
                {t('postalCode')} *
              </span>
              <Input
                value={form.shippingPostalCode}
                onChange={(event) => handleFieldChange('shippingPostalCode', event.target.value)}
                required
                maxLength={10}
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">
                {t('country')} *
              </span>
              <Input
                value={form.shippingCountry}
                onChange={(event) => handleFieldChange('shippingCountry', event.target.value)}
                required
                maxLength={80}
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </label>
          </div>

          <label
            className={`flex items-start gap-2 text-sm text-foreground ${addresses.some((address) => address.id === editingId && address.isDefault) ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
          >
            <Checkbox
              type="checkbox"
              checked={makeDefault}
              disabled={addresses.some((address) => address.id === editingId && address.isDefault)}
              onChange={(event) => setMakeDefault(event.target.checked)}
              className="mt-0.5 cursor-pointer accent-primary disabled:cursor-not-allowed"
            />
            <span>{t('setAsDefault')}</span>
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="default"
              size="lg"
              disabled={saving}
              className="rounded-lg"
            >
              {saving ? t('savingAddress') : t('saveAddress')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={cancelForm}
              className="rounded-lg"
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}

      {!formOpen && message && (
        <p role="status" className="mt-3 text-sm font-medium text-success">
          {message}
        </p>
      )}
      {!formOpen && error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
