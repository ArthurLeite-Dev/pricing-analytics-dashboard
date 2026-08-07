import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Product } from "@/lib/types";

/**
 * Escuta a coleção `products` do Firestore em tempo real.
 * Sempre que o scraper Python (ou a API Node) gravar um novo preço,
 * este hook recebe a atualização automaticamente via onSnapshot —
 * não é necessário dar refresh na página.
 */
export function useProducts(enabled = true) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setProducts(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name ?? "",
              store: data.store ?? "",
              url: data.url ?? "",
              image: data.image ?? null,
              currentPrice: data.currentPrice ?? null,
              previousPrice: data.previousPrice ?? null,
              targetPrice: data.targetPrice ?? null,
              changePct: data.changePct ?? null,
              status: data.status ?? "estavel",
              currency: data.currency ?? "BRL",
              scrapeStatus: data.scrapeStatus ?? "pending",
              createdAt: data.createdAt?.toDate?.() ?? null,
              lastUpdated: data.lastUpdated?.toDate?.() ?? null,
            } as Product;
          }),
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useProducts:", err);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [enabled]);

  return { products, loading, error };
}
