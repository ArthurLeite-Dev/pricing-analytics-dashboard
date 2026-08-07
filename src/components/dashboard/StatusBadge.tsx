import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { statusLabel, type ProductStatus } from "@/lib/monitor-data";

const styles: Record<ProductStatus, string> = {
  queda: "bg-success/15 text-success border-success/30",
  estavel: "bg-muted text-muted-foreground border-border",
  aumento: "bg-destructive/15 text-destructive border-destructive/30",
};

const icons: Record<ProductStatus, typeof Minus> = {
  queda: ArrowDownRight,
  estavel: Minus,
  aumento: ArrowUpRight,
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        styles[status],
      )}
    >
      <Icon className="size-3.5" />
      {statusLabel[status]}
    </span>
  );
}