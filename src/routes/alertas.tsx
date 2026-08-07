import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/monitor-data";
import { useAlerts } from "@/hooks/useAlerts";

export const Route = createFileRoute("/alertas")({
  head: () => ({
    meta: [
      { title: "Alertas de Preço — PriceWatch" },
      {
        name: "description",
        content: "Alertas de quedas e aumentos de preço dos produtos monitorados.",
      },
      { property: "og:title", content: "Alertas de Preço — PriceWatch" },
      {
        property: "og:description",
        content: "Saiba na hora quando um produto atinge o seu preço alvo.",
      },
    ],
  }),
  component: AlertasPage,
});

function AlertasPage() {
  const { alerts, loading } = useAlerts();

  return (
    <DashboardLayout title="Alertas de Preço" subtitle="Movimentações recentes dos seus produtos">
      <Card className="border-border/70 shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <CardTitle className="text-base">Alertas recentes</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : `${alerts.length} notificações nos últimos dias`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading &&
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}

          {!loading && alerts.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum alerta disparado ainda. Alertas aparecem aqui quando um produto atinge o preço alvo.
            </p>
          )}

          {!loading &&
            alerts.map((a) => {
              const down = a.type === "queda";
              const Icon = down ? ArrowDownRight : ArrowUpRight;
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border border-border/70 bg-secondary/40 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                >
                  <div
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      down ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.product}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.store} · alvo {formatBRL(a.target)} · atual {formatBRL(a.current)}
                    </p>
                  </div>
                  <span className="col-span-2 text-xs text-muted-foreground sm:col-span-1 sm:self-center">
                    {a.createdAt
                      ? formatDistanceToNow(a.createdAt, { addSuffix: true, locale: ptBR })
                      : ""}
                  </span>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
