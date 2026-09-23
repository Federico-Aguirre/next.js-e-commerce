import { z } from 'zod';

export const checkoutSchema = z.object({
  cardNumber: z
    .string()
    .min(1, 'El número de tarjeta es obligatorio.')
    .transform((value) => value.replace(/\s+/g, ''))
    .refine(
      (value) => /^\d{16}$/.test(value),
      'El número de tarjeta debe tener 16 dígitos.',
    ),

  cardholderName: z
    .string()
    .trim()
    .min(1, 'El nombre del titular es obligatorio.')
    .max(100, 'El nombre del titular es demasiado largo.'),

  cardExpirationMonth: z
    .string()
    .regex(/^(0[1-9]|1[0-2])$/, 'El mes debe estar entre 01 y 12.'),

  cardExpirationYear: z
    .string()
    .regex(/^\d{4}$/, 'El año debe tener 4 dígitos.'),

  securityCode: z
    .string()
    .regex(/^\d{3,4}$/, 'El CVV debe tener 3 o 4 dígitos.'),

  email: z.string().trim().email('Ingresá un email válido.'),

  docType: z.string().min(1, 'Seleccioná un tipo de documento.'),

  docNumber: z
    .string()
    .trim()
    .min(1, 'El número de documento es obligatorio.')
    .regex(/^\d+$/, 'El número de documento solo puede contener números.'),

  installments: z
    .string()
    .regex(/^[1-9]\d*$/, 'La cantidad de cuotas no es válida.'),
});

export type CheckoutFormData = z.infer<typeof checkoutSchema>;

export type FormErrors = Partial<Record<keyof CheckoutFormData, string>>;
