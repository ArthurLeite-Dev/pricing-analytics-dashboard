// Testa o contrato HTTP da rota principal do sistema (é o gatilho de todo
// o fluxo descrito no README: modal -> POST /api/products -> Firestore ->
// scraper). db e scraperService são mockados para não depender de
// credenciais reais nem de rodar o processo Python de verdade.
//
// vi.mock() é hoisted para o topo do arquivo pelo transform do vitest, por
// isso as variáveis que as factories usam precisam vir de vi.hoisted() —
// que também é hoisted, mas antes dos vi.mock() que o referenciam. Sem
// isso, seria um erro de "variável usada antes de inicializar".
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, triggerScrapeMock, triggerBatchScrapeMock } = vi.hoisted(() => {
  let docs: Record<string, unknown> = {};
  let counter = 0;

  const makeDocRef = (id: string) => ({
    id,
    get: async () => ({
      exists: id in docs,
      data: () => docs[id],
    }),
    set: async (data: unknown) => {
      docs[id] = data;
    },
  });

  return {
    fakeDb: {
      collection: (name: string) => {
        if (name !== "products") throw new Error(`coleção inesperada nos testes: ${name}`);
        return { doc: (id?: string) => makeDocRef(id ?? `auto-${++counter}`) };
      },
    },
    resetFakeDb: () => {
      docs = {};
      counter = 0;
    },
    triggerScrapeMock: vi.fn(),
    triggerBatchScrapeMock: vi.fn(),
  };
});

vi.mock("../firebaseAdmin", () => ({ db: fakeDb }));
vi.mock("../services/scraperService", () => ({
  triggerScrape: triggerScrapeMock,
  triggerBatchScrape: triggerBatchScrapeMock,
}));

// Import estático normal: o vitest garante que os vi.mock() acima já
// estão em vigor quando este módulo (e o firebaseAdmin/scraperService que
// ele importa por baixo dos panos) é carregado, não precisa de import()
// dinâmico pra isso.
import productsRouter from "./products";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/products", productsRouter);
  return app;
}

beforeEach(() => {
  resetFakeDb();
  triggerScrapeMock.mockReset().mockResolvedValue({ code: 0, output: "" });
  triggerBatchScrapeMock.mockReset().mockResolvedValue({ code: 0, output: "" });
});

describe("POST /api/products", () => {
  it("cria o produto com status pending e dispara a coleta com os dados corretos", async () => {
    const res = await request(buildApp())
      .post("/api/products")
      .send({ url: "https://loja.com/produto/1", targetPrice: 199.9 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      url: "https://loja.com/produto/1",
      store: "Loja",
      status: "pending",
    });
    expect(triggerScrapeMock).toHaveBeenCalledWith(res.body.id, "https://loja.com/produto/1", 199.9);
  });

  it("usa nome padrão 'coletando informações' quando name não é enviado", async () => {
    const res = await request(buildApp()).post("/api/products").send({ url: "https://loja.com/produto/1" });
    const stored = await fakeDb.collection("products").doc(res.body.id).get();
    expect((stored.data() as { name: string }).name).toContain("coletando informações");
  });

  it("rejeita payload sem url (400) e não dispara nenhuma coleta", async () => {
    const res = await request(buildApp()).post("/api/products").send({});
    expect(res.status).toBe(400);
    expect(triggerScrapeMock).not.toHaveBeenCalled();
  });

  it("salva o groupId quando enviado, e null quando omitido", async () => {
    const app = buildApp();

    const comGrupo = await request(app)
      .post("/api/products")
      .send({ url: "https://loja.com/produto/1", groupId: "iPhone 15 Pro 256GB" });
    const semGrupo = await request(app).post("/api/products").send({ url: "https://loja.com/produto/2" });

    const storedComGrupo = await fakeDb.collection("products").doc(comGrupo.body.id).get();
    const storedSemGrupo = await fakeDb.collection("products").doc(semGrupo.body.id).get();

    expect((storedComGrupo.data() as { groupId: string | null }).groupId).toBe("iPhone 15 Pro 256GB");
    expect((storedSemGrupo.data() as { groupId: string | null }).groupId).toBeNull();
  });

  it("rejeita targetPrice negativo (400)", async () => {
    const res = await request(buildApp())
      .post("/api/products")
      .send({ url: "https://loja.com/produto/1", targetPrice: -10 });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/products/:id/scrape", () => {
  it("retorna 404 quando o produto não existe", async () => {
    const res = await request(buildApp()).post("/api/products/id-inexistente/scrape");
    expect(res.status).toBe(404);
    expect(triggerScrapeMock).not.toHaveBeenCalled();
  });

  it("dispara a coleta e repassa o exitCode do processo, mesmo quando ele falha", async () => {
    const app = buildApp();
    const created = await request(app).post("/api/products").send({ url: "https://loja.com/produto/2" });

    // simula o processo Python rodando mas terminando com erro — a rota
    // deve responder 200 e repassar exitCode: 1 mesmo assim (é o front-end
    // que decide tratar isso como falha, não o backend)
    triggerScrapeMock.mockResolvedValueOnce({ code: 1, output: "ModuleNotFoundError" });
    const res = await request(app).post(`/api/products/${created.body.id}/scrape`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: created.body.id, triggered: true, exitCode: 1 });
  });
});

describe("POST /api/products/scrape-all", () => {
  it("responde 202 imediatamente (fire-and-forget) e dispara a coleta em lote", async () => {
    const res = await request(buildApp()).post("/api/products/scrape-all");
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ triggered: true });
    expect(triggerBatchScrapeMock).toHaveBeenCalledOnce();
  });
});
