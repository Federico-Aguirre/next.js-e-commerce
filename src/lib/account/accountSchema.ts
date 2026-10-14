import { z } from 'zod';

const personName = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;
const textWithPunctuation = /^[\p{L}\p{N}][\p{L}\p{N} .,'-]*$/u;
const phonePattern = /^\+?[0-9()\s-]+$/;
const houseNumberPattern = /^(?:\d{1,6}[A-Za-z]?(?:\s?(?:bis|ter))?|\d{1,6}-\d{1,6}|s\/?n)$/i;

export const accountSchema = z.object({
  firstName: z.string().trim().min(2).max(80).regex(personName),

  lastName: z.string().trim().min(2).max(80).regex(personName),

  phone: z
    .string()
    .trim()
    .min(8)
    .max(25)
    .regex(phonePattern)
    .refine((value) => value.replace(/\D/g, '').length >= 8)
    .refine((value) => value.replace(/\D/g, '').length <= 15),

  dni: z
    .string()
    .trim()
    .regex(/^\d{7,10}$/)
    .or(z.literal(''))
    .optional(),

  shippingStreet: z.string().trim().min(3).max(120).regex(textWithPunctuation),

  shippingNumber: z.string().trim().min(1).max(20).regex(houseNumberPattern),

  shippingApartment: z
    .string()
    .trim()
    .max(50)
    .regex(textWithPunctuation)
    .or(z.literal(''))
    .optional(),

  shippingCity: z.string().trim().min(2).max(80).regex(textWithPunctuation),

  shippingProvince: z.string().trim().min(2).max(80).regex(textWithPunctuation),

  shippingPostalCode: z
    .string()
    .trim()
    .min(3)
    .max(10)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/),

  shippingCountry: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[\p{L}][\p{L} .'-]*$/u),
});

export type AccountFormData = z.infer<typeof accountSchema>;
