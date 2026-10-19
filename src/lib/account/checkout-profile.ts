import { accountSchema, type AccountFormData } from './accountSchema';

export type CheckoutProfileValues = Partial<
  Record<keyof AccountFormData, string | null | undefined>
>;

/** Uses the same validation rules as the account form before allowing an order to be created. */
export function isCheckoutProfileComplete(profile: CheckoutProfileValues | null | undefined) {
  const result = accountSchema.safeParse({
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    phone: profile?.phone ?? '',
    // DNI and apartment remain optional according to the account form.
    dni: profile?.dni ?? '',
    shippingStreet: profile?.shippingStreet ?? '',
    shippingNumber: profile?.shippingNumber ?? '',
    shippingApartment: profile?.shippingApartment ?? '',
    shippingCity: profile?.shippingCity ?? '',
    shippingProvince: profile?.shippingProvince ?? '',
    shippingPostalCode: profile?.shippingPostalCode ?? '',
    shippingCountry: profile?.shippingCountry ?? '',
  });

  return result.success;
}
