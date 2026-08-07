import { spawn } from "node:child_process";
import path from "node:path";

const SCRAPER_PATH = path.resolve(process.cwd(), process.env.SCRAPER_PATH || "../scraper/scraper.py");
const PYTHON_BIN = process.env.PYTHON_BIN || "python3";

export interface ScrapeRunResult {
  code: number | null;
  output: string;
}

function runScraper(args: string[]): Promise<ScrapeRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [SCRAPER_PATH, ...args]);

    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk.toString()));
    child.stderr.on("data", (chunk) => (output += chunk.toString()));

    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

/** Dispara a coleta de um único produto (usado ao cadastrar um novo link). */
export function triggerScrape(productId: string, url: string, targetPrice?: number): Promise<ScrapeRunResult> {
  const args = ["--url", url, "--product-id", productId];
  if (targetPrice != null) args.push("--target-price", String(targetPrice));
  return runScraper(args);
}

/** Dispara a coleta em lote de todos os produtos monitorados (usado pelo cron). */
export function triggerBatchScrape(): Promise<ScrapeRunResult> {
  return runScraper([]);
}
