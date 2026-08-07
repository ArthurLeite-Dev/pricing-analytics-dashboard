import { Router } from "express";
import { z } from "zod";

import { db } from "../firebaseAdmin";
import { triggerBatchScrape, triggerScrape } from "../services/scraperService";

const router = Router();

const createProductSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).optional(),
  targetPrice: z.number().positive().optional(),
});

function deriveStoreName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const main = hostname.split(".")[0] || "Loja";
    return main.charAt(0).toUpperCase() + main.slice(1);
  } catch {
    return "Loja";
  }
}

// POST /api/products — recebe a URL enviada pelo modal "Adicionar novo link" do front-end.
// Cria o documento no Firestore com status "pending" (aparece na hora, via onSnapshot)
// e dispara a coleta no script Python em segundo plano — a resposta HTTP não espera
// o scraping terminar.
router.post("/", async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { url, name, targetPrice } = parsed.data;
  const store = deriveStoreName(url);
  const docRef = db.collection("products").doc();

  await docRef.set({
    url,
    name: name ?? `${store} — coletando informações...`,
    store,
    image: null,
    currentPrice: null,
    previousPrice: null,
    targetPrice: targetPrice ?? null,
    changePct: null,
    status: "estavel",
    currency: "BRL",
    scrapeStatus: "pending",
    createdAt: new Date(),
    lastUpdated: null,
  });

  triggerScrape(docRef.id, url, targetPrice).catch((err) => {
    console.error(`Erro ao coletar produto ${docRef.id}:`, err);
  });

  res.status(201).json({ id: docRef.id, url, store, status: "pending" });
});

// POST /api/products/:id/scrape — dispara uma nova coleta manual de um produto existente.
router.post("/:id/scrape", async (req, res) => {
  const { id } = req.params;
  const doc = await db.collection("products").doc(id).get();
  if (!doc.exists) {
    return res.status(404).json({ error: "Produto não encontrado" });
  }

  const data = doc.data() as { url: string; targetPrice?: number };
  const result = await triggerScrape(id, data.url, data.targetPrice);
  res.json({ id, triggered: true, exitCode: result.code });
});

// POST /api/products/scrape-all — dispara manualmente a coleta em lote de todos os produtos.
router.post("/scrape-all", async (_req, res) => {
  triggerBatchScrape().catch((err) => console.error("Erro na coleta em lote:", err));
  res.status(202).json({ triggered: true });
});

export default router;
