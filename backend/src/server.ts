import "dotenv/config";
import cors from "cors";
import express from "express";
import cron from "node-cron";

import productsRouter from "./routes/products";
import { triggerBatchScrape } from "./services/scraperService";

const app = express();

app.use(cors({ origin: (process.env.CORS_ORIGIN || "http://localhost:3000").split(",") }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/products", productsRouter);

// Coleta em lote agendada (padrão: a cada 6 horas). Ajuste via SCRAPE_CRON no .env.
const SCRAPE_CRON = process.env.SCRAPE_CRON || "0 */6 * * *";
cron.schedule(SCRAPE_CRON, () => {
  console.log(`[cron] Disparando coleta agendada (${SCRAPE_CRON})...`);
  triggerBatchScrape().catch((err) => console.error("[cron] Erro na coleta agendada:", err));
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`PriceWatch API rodando em http://localhost:${PORT}`);
});
