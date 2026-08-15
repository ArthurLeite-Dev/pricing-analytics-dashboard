import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, SearchX } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { retryScrape } from "@/lib/api";
import type { ScrapeStatus } from "@/lib/types";

/**
 * Indicador do estado TÉCNICO da última coleta (scrapeStatus), separado da
 * tendência de preço (StatusBadge = queda/estável/aumento). Sem isto, um
 * produto que falhou ficava visualmente idêntico a um que ainda não
 * terminou a primeira coleta — os dois só mostravam "—" no preço.
 *
 * "ok" não renderiza nada: é o caso comum, não precisa de destaque extra.
 */

const COPY: Record<Exclude<ScrapeStatus, "ok">, { label: string; hint: string }> = {
  pending: {
    label: "Coletando...",
    hint: "A primeira coleta deste produto ainda não terminou.",
  },
  error: {
    label: "Falha na coleta",
    hint: "Não conseguimos acessar a página da loja na última tentativa.",
  },
  not_found: {
    label: "Preço não encontrado",
    hint: "A página carregou, mas não encontramos o preço nela — o site pode ter mudado.",
  },
};

const TONE: Record<Exclude<ScrapeStatus, "ok">, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  not_found: "bg-warning/15 text-warning border-warning/30",
};

interface ScrapeStatusIndicatorProps {
  productId: string;
  status: ScrapeStatus;
}

export function ScrapeStatusIndicator({ productId, status }: ScrapeStatusIndicatorProps) {
  const [retrying, setRetrying] = useState(false);

  if (status === "ok") return null;

  const { label, hint } = COPY[status];
  const canRetry = status === "error" || status === "not_found";

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const result = await retryScrape(productId);
      if (result.exitCode !== 0) {
        // A requisição respondeu, mas o processo Python terminou com erro
        // (ex: ModuleNotFoundError) — sem isso o usuário veria "sucesso"
        // mesmo quando a coleta falhou de novo.
        toast.error("A coleta rodou, mas terminou com erro", {
          description: "O status deve refletir a falha assim que atualizar.",
        });
      } else {
        toast.success("Nova coleta concluída", {
          description: "Os dados do produto foram atualizados.",
        });
      }
    } catch (err) {
      toast.error("Não foi possível disparar a coleta", {
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
      });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <span
      title={hint}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONE[status],
      )}
    >
      {status === "pending" && <Loader2 className="size-3.5 animate-spin" />}
      {status === "error" && <AlertTriangle className="size-3.5" />}
      {status === "not_found" && <SearchX className="size-3.5" />}
      {label}
      {canRetry && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          title="Tentar coletar novamente"
          aria-label="Tentar coletar novamente"
          className="ml-1 inline-flex items-center rounded-full p-0.5 hover:bg-foreground/10 disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3", retrying && "animate-spin")} />
        </button>
      )}
    </span>
  );
}
