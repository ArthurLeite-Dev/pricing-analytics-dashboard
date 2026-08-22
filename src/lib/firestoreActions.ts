import { doc, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

/**
 * Atualiza o groupId de um produto direto no Firestore, sem passar pela
 * API Node — permitido pelas regras de segurança (mesmo padrão já usado
 * pra targetPrice: só esses dois campos são editáveis pelo client). Não
 * dispara nova coleta nem precisa de nenhuma lógica de servidor, por isso
 * não faz sentido ir pela API só pra isso.
 */
export async function updateProductGroup(productId: string, groupId: string | null): Promise<void> {
  await updateDoc(doc(db, "products", productId), { groupId });
}
