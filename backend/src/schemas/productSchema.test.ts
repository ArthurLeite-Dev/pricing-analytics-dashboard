import { describe, expect, it } from "vitest";

import { createProductSchema } from "./productSchema";

describe("createProductSchema", () => {
  it("aceita um payload mínimo válido (só a url)", () => {
    expect(createProductSchema.safeParse({ url: "https://loja.com/produto" }).success).toBe(true);
  });

  it("aceita name, targetPrice e groupId opcionais quando presentes e válidos", () => {
    const result = createProductSchema.safeParse({
      url: "https://loja.com/produto",
      name: "Produto X",
      targetPrice: 199.9,
      groupId: "iPhone 15 Pro 256GB",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita groupId vazio quando explicitamente enviado", () => {
    expect(createProductSchema.safeParse({ url: "https://loja.com/x", groupId: "" }).success).toBe(false);
  });

  it("rejeita quando a url está ausente", () => {
    expect(createProductSchema.safeParse({}).success).toBe(false);
  });

  it("rejeita uma url malformada", () => {
    expect(createProductSchema.safeParse({ url: "não é uma url" }).success).toBe(false);
  });

  it("rejeita targetPrice zero ou negativo", () => {
    expect(createProductSchema.safeParse({ url: "https://loja.com/x", targetPrice: 0 }).success).toBe(false);
    expect(createProductSchema.safeParse({ url: "https://loja.com/x", targetPrice: -10 }).success).toBe(false);
  });

  it("rejeita name vazio quando explicitamente enviado", () => {
    expect(createProductSchema.safeParse({ url: "https://loja.com/x", name: "" }).success).toBe(false);
  });
});
