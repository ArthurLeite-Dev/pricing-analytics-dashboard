import type { ReactNode } from "react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { AddLinkDialog } from "./AddLinkDialog";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function DashboardLayout({ title, subtitle, children }: Props) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
              {subtitle && (
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
              )}
            </div>
          </div>
          <AddLinkDialog />
        </div>
      </header>
      <main className="flex-1 space-y-6 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}