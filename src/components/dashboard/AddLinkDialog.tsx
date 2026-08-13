import { useState } from "react";
import { Plus, Link2, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProduct } from "@/lib/api";

export function AddLinkDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      new URL(url);
    } catch {
      setError("Informe uma URL válida (ex: https://loja.com/produto).");
      return;
    }

    let parsedTarget: number | undefined;
    if (targetPrice.trim()) {
      parsedTarget = Number(targetPrice.replace(",", "."));
      if (Number.isNaN(parsedTarget) || parsedTarget <= 0) {
        setError("O preço alvo deve ser um número maior que zero.");
        return;
      }
    }

    setError(null);
    setSubmitting(true);
    try {
      // Chama a API Node/Express (POST /api/products), que grava o produto
      // no Firestore e dispara a primeira coleta do script Python.
      await createProduct(
        parsedTarget !== undefined ? { url, targetPrice: parsedTarget } : { url },
      );
      setUrl("");
      setTargetPrice("");
      setOpen(false);
      toast.success("Link adicionado", {
        description: "Começamos a monitorar este produto — o preço aparece assim que a primeira coleta terminar.",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível adicionar o link. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Adicionar novo link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar novo link</DialogTitle>
          <DialogDescription>
            Cole o link do produto que você deseja monitorar. A API dispara a primeira coleta
            automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL do produto</Label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="url"
                placeholder="https://loja.com/produto/123"
                className="pl-9"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                disabled={submitting}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetPrice">Preço alvo (opcional)</Label>
            <div className="relative">
              <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="targetPrice"
                inputMode="decimal"
                placeholder="Ex: 199.90"
                className="pl-9"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                disabled={submitting}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Você recebe um alerta quando o preço cair até esse valor (ou passar dele).
            </p>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Monitorar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}