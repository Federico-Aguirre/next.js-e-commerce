import { z } from 'zod';
import { accountSchema } from '@/lib/account/accountSchema';

const labelPattern = /^[\p{L}\p{N}][\p{L}\p{N} .,'()/&-]*$/u;

export const deliveryAddressSchema = z.object({
  label: z.string().trim().min(2).max(60).regex(labelPattern),
  shippingStreet: accountSchema.shape.shippingStreet,
  shippingNumber: accountSchema.shape.shippingNumber,
  shippingApartment: accountSchema.shape.shippingApartment,
  shippingCity: accountSchema.shape.shippingCity,
  shippingProvince: accountSchema.shape.shippingProvince,
  shippingPostalCode: accountSchema.shape.shippingPostalCode,
  shippingCountry: accountSchema.shape.shippingCountry,
});

export const deliveryAddressUpdateSchema = deliveryAddressSchema.extend({
  isDefault: z.boolean().optional(),
});

export type DeliveryAddressFormData = z.infer<typeof deliveryAddressSchema>;
