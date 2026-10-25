'use client';

import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import DeliveryAddressBook from '@/components/DeliveryAddressBook';
import { Button } from '@/components/ui/button';
import { Input as UIInput } from '@/components/ui/input';
import { accountSchema, type AccountFormData } from '@/lib/account/accountSchema';
import { useRouter } from '@/lib/I18nRouting';

type AccountForm = {
  firstName: string;
  lastName: string;
  phone: string;
  dni: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingApartment: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostalCode: string;
  shippingCountry: string;
};

const emptyForm: AccountForm = {
  firstName: '',
  lastName: '',
  phone: '',
  dni: '',
  shippingStreet: '',
  shippingNumber: '',
  shippingApartment: '',
  shippingCity: '',
  shippingProvince: '',
  shippingPostalCode: '',
  shippingCountry: 'Argentina',
};

function Input({
  label,
  name,
  value,
  onChange,
  required = false,
  placeholder,
  error,
  onBlur,
  type = 'text',
}: {
  label: string;
  name: keyof AccountForm;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
  onBlur?: () => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-foreground">
        {label}
        {required ? ' *' : ''}
      </span>
      <UIInput
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        type={type}
        placeholder={placeholder}
        className={`w-full rounded-md border bg-card px-3 py-2.5 text-sm text-foreground transition outline-none focus:ring-1 ${
          error
            ? 'border-destructive focus:border-destructive focus:ring-destructive'
            : 'border-border focus:border-primary focus:ring-primary/20'
        }`}
      />
      {error && <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>}
    </label>
  );
}

export default function AccountPage() {
  const t = useTranslations('Account');
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AccountFormData, string>>>(
    {},
  );
  const [addressBookRefresh, setAddressBookRefresh] = useState(0);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/sign-in');
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    const loadAccount = async () => {
      try {
        const response = await fetch('/api/account');

        if (!response.ok) {
          throw new Error(t('loadError'));
        }

        const data = await response.json();

        setForm({
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          phone: data.phone ?? '',
          dni: data.dni ?? '',
          shippingStreet: data.shippingStreet ?? '',
          shippingNumber: data.shippingNumber ?? '',
          shippingApartment: data.shippingApartment ?? '',
          shippingCity: data.shippingCity ?? '',
          shippingProvince: data.shippingProvince ?? '',
          shippingPostalCode: data.shippingPostalCode ?? '',
          shippingCountry: data.shippingCountry ?? 'Argentina',
        });
      } catch (requestError) {
        console.error(requestError);
        setError(t('loadError'));
      } finally {
        setLoading(false);
      }
    };

    void loadAccount();
  }, [status, t]);

  const validateField = (name: keyof AccountFormData, value: string) => {
    const result = accountSchema.shape[name].safeParse(value);

    setFieldErrors((previous) => {
      if (result.success) {
        const next = { ...previous };
        delete next[name];
        return next;
      }

      return {
        ...previous,
        [name]: t(`errors.${name}`),
      };
    });
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const fieldName = name as keyof AccountFormData;

    setForm((previous) => ({
      ...previous,
      [fieldName]: value,
    }));

    setMessage('');
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const validationResult = accountSchema.safeParse(form);

    if (!validationResult.success) {
      const nextErrors: Partial<Record<keyof AccountFormData, string>> = {};

      for (const issue of validationResult.error.issues) {
        const field = issue.path[0] as keyof AccountFormData;

        if (!nextErrors[field]) {
          nextErrors[field] = t(`errors.${field}`);
        }
      }

      setFieldErrors(nextErrors);
      setError(t('validationError'));
      return;
    }

    setFieldErrors({});
    setSaving(true);

    try {
      const response = await fetch('/api/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('saveError'));
      }

      setForm((previous) => ({
        ...previous,
        ...data,
        dni: data.dni ?? '',
        shippingApartment: data.shippingApartment ?? '',
        shippingCountry: data.shippingCountry ?? 'Argentina',
      }));
      setMessage(t('saved'));
      setAddressBookRefresh((value) => value + 1);
    } catch (requestError) {
      console.error(requestError);
      setError(requestError instanceof Error ? requestError.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDefaultAddressChanged = async () => {
    setAddressBookRefresh((value) => value + 1);
    try {
      const response = await fetch('/api/account', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setForm({
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        phone: data.phone ?? '',
        dni: data.dni ?? '',
        shippingStreet: data.shippingStreet ?? '',
        shippingNumber: data.shippingNumber ?? '',
        shippingApartment: data.shippingApartment ?? '',
        shippingCity: data.shippingCity ?? '',
        shippingProvince: data.shippingProvince ?? '',
        shippingPostalCode: data.shippingPostalCode ?? '',
        shippingCountry: data.shippingCountry ?? 'Argentina',
      });
      setFieldErrors({});
      setMessage('');
    } catch (requestError) {
      console.error(
        'No se pudo actualizar el formulario con la dirección predeterminada.',
        requestError,
      );
    }
  };

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center">{t('loading')}</div>;
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
            <div className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t('signedInWith')}
              </p>
              <p className="mt-1 text-sm font-medium break-all text-foreground">
                {session.user.email || t('emailUnavailable')}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <section>
              <h2 className="mb-4 text-lg font-semibold text-foreground">{t('personalTitle')}</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={t('firstName')}
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  onBlur={() => validateField('firstName', form.firstName)}
                  error={fieldErrors.firstName}
                  required
                  placeholder="Juan"
                />
                <Input
                  label={t('lastName')}
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  onBlur={() => validateField('lastName', form.lastName)}
                  error={fieldErrors.lastName}
                  required
                  placeholder="Pérez"
                />
                <Input
                  label={t('phone')}
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  onBlur={() => validateField('phone', form.phone)}
                  error={fieldErrors.phone}
                  required
                  placeholder="+54 11 1234-5678"
                />
                <Input
                  label={t('dni')}
                  name="dni"
                  value={form.dni}
                  onChange={handleChange}
                  onBlur={() => validateField('dni', form.dni)}
                  error={fieldErrors.dni}
                  placeholder="12345678"
                />
              </div>

              <p className="mt-3 text-xs text-muted-foreground">{t('dniNote')}</p>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold text-foreground">{t('shippingTitle')}</h2>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Input
                    label={t('street')}
                    name="shippingStreet"
                    value={form.shippingStreet}
                    onChange={handleChange}
                    onBlur={() => validateField('shippingStreet', form.shippingStreet)}
                    error={fieldErrors.shippingStreet}
                    required
                    placeholder="Av. Corrientes"
                  />
                </div>
                <Input
                  label={t('number')}
                  name="shippingNumber"
                  value={form.shippingNumber}
                  onChange={handleChange}
                  onBlur={() => validateField('shippingNumber', form.shippingNumber)}
                  error={fieldErrors.shippingNumber}
                  required
                  placeholder="1234"
                />
                <Input
                  label={t('apartment')}
                  name="shippingApartment"
                  value={form.shippingApartment}
                  onChange={handleChange}
                  onBlur={() => validateField('shippingApartment', form.shippingApartment)}
                  error={fieldErrors.shippingApartment}
                  placeholder="4° B"
                />
                <Input
                  label={t('city')}
                  name="shippingCity"
                  value={form.shippingCity}
                  onChange={handleChange}
                  onBlur={() => validateField('shippingCity', form.shippingCity)}
                  error={fieldErrors.shippingCity}
                  required
                  placeholder="CABA"
                />
                <Input
                  label={t('province')}
                  name="shippingProvince"
                  value={form.shippingProvince}
                  onChange={handleChange}
                  onBlur={() => validateField('shippingProvince', form.shippingProvince)}
                  error={fieldErrors.shippingProvince}
                  required
                  placeholder="Buenos Aires"
                />
                <Input
                  label={t('postalCode')}
                  name="shippingPostalCode"
                  value={form.shippingPostalCode}
                  onChange={handleChange}
                  onBlur={() => validateField('shippingPostalCode', form.shippingPostalCode)}
                  error={fieldErrors.shippingPostalCode}
                  required
                  placeholder="C1043"
                />
                <div className="sm:col-span-2">
                  <Input
                    label={t('country')}
                    name="shippingCountry"
                    value={form.shippingCountry}
                    onChange={handleChange}
                    onBlur={() => validateField('shippingCountry', form.shippingCountry)}
                    error={fieldErrors.shippingCountry}
                    required
                    placeholder="Argentina"
                  />
                </div>
              </div>
            </section>

            {message && (
              <p className="rounded-md bg-success/10 px-3 py-2 text-sm font-medium text-success">
                {message}
              </p>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? t('saving') : t('save')}
            </Button>
          </form>

          <DeliveryAddressBook
            refreshSignal={addressBookRefresh}
            onDefaultAddressChanged={() => void handleDefaultAddressChanged()}
          />
        </div>
      </div>
    </div>
  );
}
