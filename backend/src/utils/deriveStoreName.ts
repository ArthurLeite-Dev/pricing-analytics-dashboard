// Extraído de routes/products.ts para poder ser testado sem precisar
// importar o módulo da rota inteira (que carrega ../firebaseAdmin e exige
// credenciais reais só para o arquivo ser importado).

/** Heurística simples: usa o hostname como nome da loja (ex: "amazon.com.br" -> "Amazon"). */
export function deriveStoreName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const main = hostname.split(".")[0] || "Loja";
    return main.charAt(0).toUpperCase() + main.slice(1);
  } catch {
    return "Loja";
  }
}
