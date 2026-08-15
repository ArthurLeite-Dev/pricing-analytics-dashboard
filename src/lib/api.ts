/**
 * Cliente para a API Node.js + Express que fica em /backend.
 * Ela é o intermediário entre o modal "Adicionar novo link" e o
 * script Python de scraping (veja INTEGRATION.md).
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export interface CreateProductInput {
  url: string;
  name?: string;
  targetPrice?: number;
}

export interface CreateProductResponse {
  id: string;
  url: string;
  store: string;
  status: string;
}

export async function createProduct(input: CreateProductInput): Promise<CreateProductResponse> {
  const response = await fetch(`${API_BASE_URL}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Falha ao adicionar produto (HTTP ${response.status})`);
  }

  return response.json();
}

export interface RetryScrapeResponse {
  id: string;
  triggered: boolean;
  /** Exit code do processo Python: 0 = ok, outro valor = terminou com erro
   * mesmo que a requisição HTTP em si tenha respondido 200. */
  exitCode: number | null;
}

/**
 * Dispara manualmente uma nova coleta para um produto existente
 * (POST /api/products/:id/scrape). A requisição só resolve quando o
 * processo Python termina — não é fire-and-forget como createProduct.
 */
export async function retryScrape(productId: string): Promise<RetryScrapeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/products/${productId}/scrape`, {
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Falha ao disparar nova coleta (HTTP ${response.status})`);
  }

  return response.json();
}
