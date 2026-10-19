import { describe, expect, it } from 'vitest';
import { isCheckoutProfileComplete, type CheckoutProfileValues } from './checkout-profile';

const completeProfile: CheckoutProfileValues = {
  firstName: 'Ana',
  lastName: 'Pérez',
  phone: '+54 11 1234-5678',
  dni: '',
  shippingStreet: 'Av. Corrientes',
  shippingNumber: '1234',
  shippingApartment: '',
  shippingCity: 'CABA',
  shippingProvince: 'Buenos Aires',
  shippingPostalCode: 'C1043',
  shippingCountry: 'Argentina',
};

describe('isCheckoutProfileComplete', () => {
  it('accepts a valid required profile when DNI and apartment are empty', () => {
    expect(isCheckoutProfileComplete(completeProfile)).toBe(true);
  });

  it('rejects missing personal details or delivery address fields', () => {
    expect(isCheckoutProfileComplete({ ...completeProfile, firstName: '' })).toBe(false);
    expect(isCheckoutProfileComplete({ ...completeProfile, phone: null })).toBe(false);
    expect(isCheckoutProfileComplete({ ...completeProfile, shippingStreet: '' })).toBe(false);
    expect(isCheckoutProfileComplete({ ...completeProfile, shippingPostalCode: '' })).toBe(false);
  });

  it('rejects values that do not pass the account form validation', () => {
    expect(isCheckoutProfileComplete({ ...completeProfile, phone: 'telefono' })).toBe(false);
    expect(isCheckoutProfileComplete({ ...completeProfile, shippingNumber: 'sin número' })).toBe(
      false,
    );
  });

  it('rejects an incomplete profile object', () => {
    expect(isCheckoutProfileComplete(null)).toBe(false);
    expect(isCheckoutProfileComplete(undefined)).toBe(false);
  });
});
