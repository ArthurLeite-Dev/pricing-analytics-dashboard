import { createFileRoute } from "@tanstack/react-router";
import { Package, TrendingDown, Percent } from "lucide-react";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PriceTrendChart, StoreComparisonChart } from "@/components/dashboard/PriceCharts";
import { ProductTable } from "@/components/dashboard/ProductTable";
import { useProducts } from "@/hooks/useProducts";
import type { Product } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão Geral — PriceWatch" },
      {
        name: "description",
        content:
          "Painel de análise de preços com métricas, gráficos de variação e comparativo entre lojas.",
      },
      { property: "og:title", content: "Visão Geral — PriceWatch" },
      {
        property: "og:description",
        content: "Acompanhe quedas de preço, descontos médios e produtos monitorados.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  // Um único listener onSnapshot aqui; PriceTrendChart, StoreComparisonChart
  // e ProductTable recebem os dados já carregados via prop `products` em vez
  // de abrir cada um o seu próprio listener nesta página.
  const { products, loading } = useProducts();

  const biggestDrop = products
    .filter((p): p is Product & { changePct: number } => p.changePct != null)
    .reduce<(Product & { changePct: number }) | null>(
      (lowest, p) => (!lowest || p.changePct < lowest.changePct ? p : lowest),
      null,
    );

  const productsInDrop = products.filter((p) => p.changePct != null && p.changePct < 0);
  const avgDiscountPct =
    productsInDrop.length > 0
      ? productsInDrop.reduce((sum, p) => sum + Math.abs(p.changePct!), 0) / productsInDrop.length
      : null;

  return (
    <DashboardLayout title="Visão Geral" subtitle="Resumo do monitoramento de preços">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Produtos monitorados"
          value={loading ? "…" : String(products.length)}
          icon={Package}
        />
        <MetricCard
          label="Maior queda"
          value={biggestDrop ? `${biggestDrop.changePct.toFixed(1)}%` : "—"}
          hint={biggestDrop ? `${biggestDrop.name} — ${biggestDrop.store}` : "Nenhuma variação registrada ainda"}
          icon={TrendingDown}
          tone="success"
        />
        <MetricCard
          label="Média de desconto"
          value={avgDiscountPct != null ? `${avgDiscountPct.toFixed(1)}%` : "—"}
          hint="Entre os produtos em queda"
          icon={Percent}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PriceTrendChart products={loading ? undefined : products} />
        <StoreComparisonChart products={loading ? undefined : products} />
      </section>

      <ProductTable limit={5} products={loading ? undefined : products} />
    </DashboardLayout>
  );
}
