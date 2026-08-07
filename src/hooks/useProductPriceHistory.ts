import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { PricePoint } from "@/lib/types";

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * Escuta products/{productId}/priceHistory em tempo real e devolve os
 * pontos já formatados para o formato {date, price} usado pelo
 * PriceTrendChart (recharts).
 */
export function useProductPriceHistory(productId: string | undefined) {
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "products", productId, "priceHistory"),
      orderBy("scrapedAt", "asc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setHistory(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            const scrapedAt: Date = data.scrapedAt?.toDate?.() ?? new Date();
            return { date: shortDate.format(scrapedAt), price: data.price ?? 0 };
          }),
        );
        setLoading(false);
      },
      (err) => {
        console.error("useProductPriceHistory:", err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [productId]);

  return { history, loading };
}
