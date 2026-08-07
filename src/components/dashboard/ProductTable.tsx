import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatBRL, placeholderImage } from "@/lib/monitor-data";
import type { Product, ProductStatus } from "@/lib/types";
import { useProducts } from "@/hooks/useProducts";
import { StatusBadge } from "./StatusBadge";

interface Props {
  limit?: number;
  /** Opcional: passe a lista já carregada (ex: pela página) para não abrir um 2º listener no Firestore. */
  products?: Product[];
}

export function ProductTable({ limit, products: externalProducts }: Props) {
  const [query, setQuery] = useState("");
  const [store, setStore] = useState("all");
  const [status, setStatus] = useState("all");

  const { products: fetchedProducts, loading } = useProducts(externalProducts === undefined);
  const products = externalProducts ?? fetchedProducts;
  const stores = useMemo(() => Array.from(new Set(products.map((p) => p.store))), [products]);

  const rows = useMemo(() => {
    const filtered = products.filter((p) => {
      const matchesQuery = p.name.toLowerCase().includes(query.trim().toLowerCase());
      const matchesStore = store === "all" || p.store === store;
      const matchesStatus = status === "all" || p.status === (status as ProductStatus);
      return matchesQuery && matchesStore && matchesStatus;
    });
    return limit ? filtered.slice(0, limit) : filtered;
  }, [products, query, store, status, limit]);

  return (
    <Card className="border-border/70 shadow-[var(--shadow-elegant)]">
      <CardHeader className="gap-4">
        <div className="grid gap-1">
          <CardTitle className="text-base">Produtos monitorados</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : `${rows.length} produto(s) encontrados`}
          </CardDescription>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={store} onValueChange={setStore}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue placeholder="Loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="queda">Em Queda</SelectItem>
              <SelectItem value="estavel">Estável</SelectItem>
              <SelectItem value="aumento">Aumentou</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        {loading ? (
          <div className="space-y-3 px-4 sm:px-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="space-y-3 px-4 sm:hidden">
              {rows.map((p) => (
                <li
                  key={p.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3"
                >
                  <img
                    src={p.image ?? placeholderImage(p.id)}
                    alt={p.name}
                    loading="lazy"
                    className="size-14 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.store}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-sm font-semibold">
                        {p.currentPrice != null ? formatBRL(p.currentPrice) : "—"}
                      </span>
                      {p.targetPrice != null && (
                        <span className="text-xs text-muted-foreground">
                          alvo {formatBRL(p.targetPrice)}
                        </span>
                      )}
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                </li>
              ))}
              {rows.length === 0 && (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </li>
              )}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead className="text-right">Preço atual</TableHead>
                    <TableHead className="text-right">Preço alvo</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id} className="transition-colors hover:bg-accent/40">
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <img
                            src={p.image ?? placeholderImage(p.id)}
                            alt={p.name}
                            loading="lazy"
                            className="size-10 shrink-0 rounded-lg object-cover"
                          />
                          <span className="truncate font-medium">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.store}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {p.currentPrice != null ? formatBRL(p.currentPrice) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.targetPrice != null ? formatBRL(p.targetPrice) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium",
                          p.changePct != null && p.changePct < 0 && "text-success",
                          p.changePct != null && p.changePct > 0 && "text-destructive",
                        )}
                      >
                        {p.changePct != null ? `${p.changePct > 0 ? "+" : ""}${p.changePct.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={p.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Nenhum produto encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
