import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, BellRing, Settings, LineChart, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { title: "Visão Geral", url: "/", icon: LayoutDashboard },
  { title: "Produtos Monitorados", url: "/produtos", icon: Package },
  { title: "Alertas de Preço", url: "/alertas", icon: BellRing },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <LineChart className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">PriceWatch</p>
              <p className="truncate text-xs text-muted-foreground">Monitor de preços</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-3 py-3">
        {user && (
          <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/40 px-2 py-2">
            {!collapsed && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
            <button
              type="button"
              onClick={() => auth && signOut(auth)}
              title="Sair"
              className="grid shrink-0 size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}