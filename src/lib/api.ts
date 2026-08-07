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
