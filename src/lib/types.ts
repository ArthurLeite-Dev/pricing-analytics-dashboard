/**
 * Tipos compartilhados entre os componentes do dashboard e os hooks
 * que leem dados do Firestore (src/hooks/*).
 *
 * Estes tipos espelham o schema das coleções `products` e `alerts`
 * descrito em INTEGRATION.md.
 */

export type ProductStatus = "queda" | "estavel" | "aumento";

/** Status técnico da última tentativa de coleta (scraping), independente da tendência de preço. */
export type ScrapeStatus = "pending" | "ok" | "error" | "not_found";

export interface Product {
  id: string;
  name: string;
  store: string;
  url: string;
  image: string | null;
  currentPrice: number | null;
  previousPrice: number | null;
  targetPrice: number | null;
  changePct: number | null;
  status: ProductStatus;
  currency: string;
  scrapeStatus: ScrapeStatus;
  createdAt: Date | null;
  lastUpdated: Date | null;
}

/** Um ponto do histórico de preço de um produto (subcoleção products/{id}/priceHistory). */
export interface PricePoint {
  date: string;
  price: number;
}

/** Preço médio atual por loja, usado no gráfico comparativo. */
export interface StoreComparisonPoint {
  store: string;
  price: number;
}

export interface Alert {
  id: string;
  productId: string;
  product: string;
  store: string;
  target: number;
  current: number;
  type: "queda" | "aumento";
  createdAt: Date | null;
  read: boolean;
}
