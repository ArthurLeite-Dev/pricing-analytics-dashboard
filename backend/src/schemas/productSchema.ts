// Extraído de routes/products.ts pelo mesmo motivo de deriveStoreName.ts:
// permite testar as regras de validação sem importar ../firebaseAdmin.
import { z } from "zod";

export const createProductSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).optional(),
  targetPrice: z.number().positive().optional(),
  // Rótulo livre pra agrupar "o mesmo item" cadastrado em lojas
  // diferentes — usado pelo StoreComparisonChart no front-end.
  groupId: z.string().min(1).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
