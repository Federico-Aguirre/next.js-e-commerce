import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(2, 'nameRequired'),
  email: z.email('invalidEmail'),
  affair: z.string().min(3, 'affairRequired'),
  consultation: z.string().min(10, 'messageTooShort'),
  hp_company: z.string().optional(),
  formTimestamp: z.number(),
});

export type ContactFormData = z.infer<typeof contactSchema>;
