import { useEffect, useState } from "react";
import { collection, limit as fbLimit, onSnapshot, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Alert } from "@/lib/types";

/**
 * Escuta a coleção `alerts` do Firestore em tempo real, mais recentes
 * primeiro. Alertas são criados pelo scraper Python quando um produto
 * cruza o preço-alvo (targetPrice) definido pelo usuário.
 */
export function useAlerts(max = 50) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "alerts"), orderBy("createdAt", "desc"), fbLimit(max));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setAlerts(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              productId: data.productId ?? "",
              product: data.product ?? "",
              store: data.store ?? "",
              target: data.target ?? 0,
              current: data.current ?? 0,
              type: data.type ?? "queda",
              createdAt: data.createdAt?.toDate?.() ?? null,
              read: data.read ?? false,
            } as Alert;
          }),
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useAlerts:", err);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [max]);

  return { alerts, loading, error };
}
