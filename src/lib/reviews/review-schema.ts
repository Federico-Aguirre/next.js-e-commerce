import { z } from 'zod';

export const productReviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(''),
});

export type ProductReviewInput = z.infer<typeof productReviewInputSchema>;
