/**
 * Helpers de exibição usados em todo o dashboard.
 *
 * Os dados mockados que existiam aqui (products, priceHistory,
 * storeComparison, alerts) foram REMOVIDOS: eles agora vêm em tempo
 * real do Firestore através dos hooks em `src/hooks/` (useProducts,
 * useAlerts, useProductPriceHistory). Veja INTEGRATION.md.
 */

export type { ProductStatus, ScrapeStatus, Product, PricePoint, StoreComparisonPoint, Alert } from "./types";
import type { ProductStatus } from "./types";

export const statusLabel: Record<ProductStatus, string> = {
  queda: "Em Queda",
  estavel: "Estável",
  aumento: "Aumentou",
};

export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Avatar de fallback para produtos que ainda não têm imagem coletada. */
export const placeholderImage = (seed: string) => `https://picsum.photos/seed/${seed}/160/160`;
