import { describe, expect, it } from "vitest";

import { deriveStoreName } from "./deriveStoreName";

describe("deriveStoreName", () => {
  it.each([
    ["https://www.amazon.com.br/dp/xyz", "Amazon"],
    ["https://kabum.com.br/produto/123", "Kabum"],
    ["https://www.mercadolivre.com.br/item", "Mercadolivre"],
  ])("deriva de %s -> %s", (url, expected) => {
    expect(deriveStoreName(url)).toBe(expected);
  });

  it("cai em 'Loja' para uma string que não é uma URL válida", () => {
    expect(deriveStoreName("isso não é uma url")).toBe("Loja");
  });

  it("cai em 'Loja' quando o hostname é vazio", () => {
    // file:// é uma URL válida com hostname vazio
    expect(deriveStoreName("file:///etc/passwd")).toBe("Loja");
  });
});
