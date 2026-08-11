import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const SCRAPER_PATH = path.resolve(process.cwd(), process.env.SCRAPER_PATH || "../scraper/scraper.py");

// Por padrão, aponta DIRETO para o python de dentro do .venv do scraper —
// não depende do PATH nem de qual terminal/shell chamou a API (o processo
// Node não "herda" um venv que você ativou manualmente em outro terminal).
// Se PYTHON_BIN vier como um caminho (contém "/" ou "\"), resolve relativo
// ao diretório de onde o processo foi iniciado; caso contrário, trata como
// um comando de PATH (ex: "python3").
function resolvePythonBin(): string {
  const raw = process.env.PYTHON_BIN;
  if (raw && (raw.includes("/") || raw.includes("\\"))) {
    return path.resolve(process.cwd(), raw);
  }
  if (raw) return raw;

  const defaultRelative =
    os.platform() === "win32" ? "../scraper/.venv/Scripts/python.exe" : "../scraper/.venv/bin/python";
  return path.resolve(process.cwd(), defaultRelative);
}

const PYTHON_BIN = resolvePythonBin();

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
    child.on("close", (code) => {
      if (code !== 0) {
        // O processo rodou mas terminou com erro (ex: ModuleNotFoundError) —
        // isso NÃO dispara a Promise rejection, por isso logamos aqui também.
        console.error(`[scraper] saiu com código ${code}. Saída:\n${output}`);
      }
      resolve({ code, output });
    });
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
