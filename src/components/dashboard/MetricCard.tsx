import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "destructive";
}

export function MetricCard({ label, value, hint, icon: Icon, tone = "default" }: Props) {
  return (
    <Card className="border-border/70 bg-card shadow-[var(--shadow-elegant)]">
      <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 text-2xl font-bold sm:text-3xl",
              tone === "success" && "text-success",
              tone === "destructive" && "text-destructive",
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl border border-border/70 bg-secondary text-muted-foreground",
            tone === "success" && "bg-success/15 text-success border-success/25",
            tone === "destructive" && "bg-destructive/15 text-destructive border-destructive/25",
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}