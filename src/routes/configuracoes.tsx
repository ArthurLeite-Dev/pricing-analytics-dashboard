import { createFileRoute } from "@tanstack/react-router";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — PriceWatch" },
      {
        name: "description",
        content: "Ajuste notificações, frequência de verificação e preferências de monitoramento.",
      },
      { property: "og:title", content: "Configurações — PriceWatch" },
      {
        property: "og:description",
        content: "Personalize alertas e a frequência de checagem de preços.",
      },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  return (
    <DashboardLayout title="Configurações" subtitle="Preferências da sua conta e alertas">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 shadow-[var(--shadow-elegant)]">
          <CardHeader>
            <CardTitle className="text-base">Notificações</CardTitle>
            <CardDescription>Escolha como deseja ser avisado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { id: "email", label: "E-mail", desc: "Resumo diário de quedas de preço" },
              { id: "push", label: "Push", desc: "Alerta imediato ao atingir o preço alvo" },
              { id: "week", label: "Relatório semanal", desc: "Desempenho dos produtos na semana" },
            ].map((o) => (
              <div
                key={o.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"
              >
                <div className="min-w-0">
                  <Label htmlFor={o.id} className="text-sm">
                    {o.label}
                  </Label>
                  <p className="truncate text-xs text-muted-foreground">{o.desc}</p>
                </div>
                <Switch id={o.id} defaultChecked={o.id !== "week"} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-[var(--shadow-elegant)]">
          <CardHeader>
            <CardTitle className="text-base">Monitoramento</CardTitle>
            <CardDescription>Regras padrão para novos links</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="freq">Frequência de verificação (horas)</Label>
              <Input id="freq" type="number" defaultValue={6} min={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drop">Desconto mínimo para alerta (%)</Label>
              <Input id="drop" type="number" defaultValue={5} min={1} />
            </div>
            <Button className="w-full sm:w-auto">Salvar alterações</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}