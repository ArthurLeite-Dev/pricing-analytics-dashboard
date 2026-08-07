import { createFileRoute } from "@tanstack/react-router";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProductTable } from "@/components/dashboard/ProductTable";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos Monitorados — PriceWatch" },
      {
        name: "description",
        content: "Lista completa de produtos monitorados com busca, filtros por loja e status.",
      },
      { property: "og:title", content: "Produtos Monitorados — PriceWatch" },
      {
        property: "og:description",
        content: "Busque e filtre todos os produtos que você acompanha em um só lugar.",
      },
    ],
  }),
  component: ProdutosPage,
});

function ProdutosPage() {
  return (
    <DashboardLayout title="Produtos Monitorados" subtitle="Todos os links que você acompanha">
      <ProductTable />
    </DashboardLayout>
  );
}