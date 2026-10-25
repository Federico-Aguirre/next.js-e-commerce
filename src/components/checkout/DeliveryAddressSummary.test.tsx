import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) =>
    ({
      checkoutTitle: 'Dirección de entrega',
      checkoutSubtitle: 'Elegí a qué domicilio querés recibir este pedido.',
      manageAddresses: 'Administrar direcciones',
      loadingCheckoutAddresses: 'Cargando direcciones guardadas...',
      noCheckoutAddresses: 'Todavía no tenés una dirección guardada.',
      selectDeliveryAddress: 'Seleccionar dirección de entrega',
      recipient: 'Recibe',
      deliveryQuoteHint: 'El costo del envío y los impuestos se calculan según esta dirección.',
      defaultAddress: 'Predeterminada',
      newAddress: 'Agregar dirección',
    })[key] ?? key,
}));

import DeliveryAddressSummary from './DeliveryAddressSummary';

const addresses = [
  {
    id: 'address-home',
    label: 'Casa',
    shippingStreet: 'Av. Corrientes',
    shippingNumber: '1234',
    shippingApartment: null,
    shippingCity: 'CABA',
    shippingProvince: 'Buenos Aires',
    shippingPostalCode: 'C1043',
    shippingCountry: 'Argentina',
    isDefault: true,
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
  },
  {
    id: 'address-work',
    label: 'Trabajo',
    shippingStreet: 'Av. Santa Fe',
    shippingNumber: '555',
    shippingApartment: 'Piso 2',
    shippingCity: 'CABA',
    shippingProvince: 'Buenos Aires',
    shippingPostalCode: 'C1059',
    shippingCountry: 'Argentina',
    isDefault: false,
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-21T00:00:00.000Z',
  },
];

function jsonResponse(data: unknown, ok = true) {
  return { ok, json: async () => data };
}

function CheckoutHarness() {
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const onAddressesLoaded = useCallback((id: string | null) => {
    setSelectedAddressId(id);
    setLoaded(true);
  }, []);

  return (
    <>
      <DeliveryAddressSummary
        selectedAddressId={selectedAddressId}
        onSelectedAddressChange={setSelectedAddressId}
        onAddressesLoaded={onAddressesLoaded}
      />
      <p data-testid="selected-address">{selectedAddressId ?? 'none'}</p>
      <p data-testid="loaded">{String(loaded)}</p>
    </>
  );
}

describe('DeliveryAddressSummary', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/account/addresses') {
          return Promise.resolve(jsonResponse({ addresses }));
        }
        return Promise.resolve(
          jsonResponse({ firstName: 'Ana', lastName: 'Pérez', phone: '1123456789', dni: null }),
        );
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('selects the default address and lets the customer choose another saved address', async () => {
    render(<CheckoutHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('selected-address')).toHaveTextContent('address-home'),
    );
    expect(screen.getAllByRole('radio')[0]).toBeChecked();
    expect(screen.getByText(/Recibe: Ana Pérez/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('radio')[1]!);

    expect(screen.getByTestId('selected-address')).toHaveTextContent('address-work');
    expect(screen.getAllByRole('radio')[1]).toBeChecked();
    expect(screen.getByText(/Av\. Santa Fe 555/)).toBeInTheDocument();
  });

  it('does not reload private address data just because the selection changed', async () => {
    render(<CheckoutHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('selected-address')).toHaveTextContent('address-home'),
    );
    fireEvent.click(screen.getAllByRole('radio')[1]!);

    await waitFor(() =>
      expect(screen.getByTestId('selected-address')).toHaveTextContent('address-work'),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
