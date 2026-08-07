import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/monitor-data";
import type { Product, StoreComparisonPoint } from "@/lib/types";
import { useProducts } from "@/hooks/useProducts";
import { useProductPriceHistory } from "@/hooks/useProductPriceHistory";

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--muted-foreground)" },
  cursor: { fill: "var(--accent)", opacity: 0.35 },
} as const;

/** Produto "em destaque" no gráfico de tendência: o de maior queda percentual. */
function pickFeaturedProduct(products: Product[]): Product | undefined {
  if (products.length === 0) return undefined;
  const withChange = products.filter((p) => p.changePct !== null);
  if (withChange.length === 0) return products[0];
  return withChange.reduce((lowest, p) => (p.changePct! < lowest.changePct! ? p : lowest));
}

interface ChartProps {
  /** Opcional: passe a lista já carregada (ex: pela página) para não abrir um 2º listener no Firestore. */
  products?: Product[];
}

export function PriceTrendChart({ products: externalProducts }: ChartProps = {}) {
  const { products: fetchedProducts, loading: loadingProducts } = useProducts(
    externalProducts === undefined,
  );
  const products = externalProducts ?? fetchedProducts;
  const featured = pickFeaturedProduct(products);
  const { history, loading: loadingHistory } = useProductPriceHistory(featured?.id);
  const loading = (externalProducts === undefined && loadingProducts) || loadingHistory;

  return (
    <Card className="border-border/70 shadow-[var(--shadow-elegant)]">
      <CardHeader>
        <CardTitle className="text-base">Variação de preço</CardTitle>
        <CardDescription>
          {featured ? `${featured.name} — histórico de preço` : "Nenhum produto monitorado ainda"}
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[260px] px-2 sm:px-4">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : history.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Ainda não há histórico de preço coletado para este produto.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis
                {...axisProps}
                width={56}
                domain={["dataMin - 250", "dataMax + 250"]}
                tickFormatter={(v: number) => `R$${Math.round(v)}`}
              />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [formatBRL(v), "Preço"]} />
              <Area
                type="monotone"
                dataKey="price"
                stroke="var(--chart-1)"
                strokeWidth={2.5}
                fill="url(#priceFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Agrupa os produtos monitorados por loja e calcula o preço atual médio de cada uma. */
function buildStoreComparison(products: Product[]): StoreComparisonPoint[] {
  const byStore = new Map<string, { total: number; count: number }>();

  for (const p of products) {
    if (p.currentPrice == null) continue;
    const key = p.store || "Outra loja";
    const entry = byStore.get(key) ?? { total: 0, count: 0 };
    entry.total += p.currentPrice;
    entry.count += 1;
    byStore.set(key, entry);
  }

  return Array.from(byStore.entries()).map(([store, { total, count }]) => ({
    store,
    price: Math.round((total / count) * 100) / 100,
  }));
}

export function StoreComparisonChart({ products: externalProducts }: ChartProps = {}) {
  const { products: fetchedProducts, loading: loadingProducts } = useProducts(
    externalProducts === undefined,
  );
  const products = externalProducts ?? fetchedProducts;
  const loading = externalProducts === undefined && loadingProducts;
  const data = buildStoreComparison(products);

  return (
    <Card className="border-border/70 shadow-[var(--shadow-elegant)]">
      <CardHeader>
        <CardTitle className="text-base">Comparativo entre lojas</CardTitle>
        <CardDescription>Preço médio atual dos produtos monitorados, por loja</CardDescription>
      </CardHeader>
      <CardContent className="h-[260px] px-2 sm:px-4">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Nenhum produto monitorado ainda.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="store" {...axisProps} interval={0} tickMargin={8} />
              <YAxis
                {...axisProps}
                width={56}
                domain={["dataMin - 250", "dataMax + 250"]}
                tickFormatter={(v: number) => `R$${Math.round(v)}`}
              />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [formatBRL(v), "Preço"]} />
              <Bar dataKey="price" fill="var(--chart-2)" radius={[8, 8, 0, 0]} maxBarSize={48} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
