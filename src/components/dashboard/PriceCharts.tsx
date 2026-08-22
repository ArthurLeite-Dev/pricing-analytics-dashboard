import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface ProductGroup {
  groupId: string;
  members: Product[];
}

/**
 * Agrupa os produtos que compartilham groupId — o mesmo item cadastrado
 * em lojas diferentes (ver GroupPicker/ProductTable). Só entram grupos
 * com 2+ membros: 1 produto sozinho não é uma comparação entre lojas.
 */
function buildProductGroups(products: Product[]): ProductGroup[] {
  const byGroup = new Map<string, Product[]>();

  for (const p of products) {
    if (!p.groupId) continue;
    const members = byGroup.get(p.groupId) ?? [];
    members.push(p);
    byGroup.set(p.groupId, members);
  }

  return Array.from(byGroup.entries())
    .filter(([, members]) => members.length >= 2)
    .map(([groupId, members]) => ({ groupId, members }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId));
}

/** Preço atual de cada membro de um grupo, um ponto por loja. */
function buildStoreComparison(members: Product[]): StoreComparisonPoint[] {
  return members
    .filter((p): p is Product & { currentPrice: number } => p.currentPrice != null)
    .map((p) => ({
      productId: p.id,
      store: p.store || "Outra loja",
      price: p.currentPrice,
      name: p.name,
    }));
}

export function StoreComparisonChart({ products: externalProducts }: ChartProps = {}) {
  const { products: fetchedProducts, loading: loadingProducts } = useProducts(
    externalProducts === undefined,
  );
  const products = externalProducts ?? fetchedProducts;
  const loading = externalProducts === undefined && loadingProducts;

  const groups = useMemo(() => buildProductGroups(products), [products]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined);

  // O grupo escolhido manualmente, se ainda existir na lista; senão o
  // primeiro disponível — sem precisar sincronizar via useEffect.
  const selectedGroup = groups.find((g) => g.groupId === selectedGroupId) ?? groups[0];
  const data = selectedGroup ? buildStoreComparison(selectedGroup.members) : [];

  return (
    <Card className="border-border/70 shadow-[var(--shadow-elegant)]">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle className="text-base">Comparativo entre lojas</CardTitle>
            <CardDescription>
              {selectedGroup
                ? `Preço de "${selectedGroup.groupId}" em cada loja monitorada`
                : "Preço do mesmo item em lojas diferentes"}
            </CardDescription>
          </div>
          {groups.length > 1 && (
            <Select value={selectedGroup?.groupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue placeholder="Escolha um grupo" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.groupId} value={g.groupId}>
                    {g.groupId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="h-[260px] px-2 sm:px-4">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-sm text-muted-foreground">
            <p>Nenhum grupo de comparação ainda.</p>
            <p className="text-xs">
              Marque 2 ou mais produtos como o mesmo item ("Agrupar produto" na tabela) pra comparar
              o preço deles aqui.
            </p>
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
              <Tooltip
                {...tooltipStyle}
                formatter={(v: number, _name: string, item: { payload?: { name?: string } }) => [
                  formatBRL(v),
                  item?.payload?.name ?? "Preço",
                ]}
              />
              <Bar dataKey="price" fill="var(--chart-2)" radius={[8, 8, 0, 0]} maxBarSize={48} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
