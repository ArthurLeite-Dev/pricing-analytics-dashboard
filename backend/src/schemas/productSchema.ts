// Extraído de routes/products.ts pelo mesmo motivo de deriveStoreName.ts:
// permite testar as regras de validação sem importar ../firebaseAdmin.
import { z } from "zod";

export const createProductSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).optional(),
  targetPrice: z.number().positive().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
