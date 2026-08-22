import { useState } from "react";
import { Check, Tags, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface GroupPickerProps {
  value: string | null;
  onChange: (groupId: string | null) => void;
  existingGroups: string[];
  placeholder?: string;
}

/**
 * Combobox pra escolher um grupo já existente ou criar um novo digitando
 * um nome livre. Produtos com o mesmo grupo aparecem juntos no
 * StoreComparisonChart (comparação de preço entre lojas do "mesmo item").
 *
 * Componente controlado — não sabe nada de Firestore. Quem usa decide o
 * que fazer no onChange: atualizar estado de formulário (AddLinkDialog)
 * ou gravar direto no Firestore (ProductTable, via firestoreActions).
 */
export function GroupPicker({ value, onChange, existingGroups, placeholder = "Agrupar produto" }: GroupPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const trimmedSearch = search.trim();
  const alreadyExists = existingGroups.some((g) => g.toLowerCase() === trimmedSearch.toLowerCase());
  const canCreate = trimmedSearch.length > 0 && !alreadyExists;

  const select = (groupId: string | null) => {
    onChange(groupId);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-7 max-w-[180px] justify-start gap-1.5 px-2 text-xs font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <Tags className="size-3.5 shrink-0" />
          <span className="truncate">{value ?? placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar ou criar grupo..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nenhum grupo ainda — digite um nome pra criar.</CommandEmpty>
            <CommandGroup>
              {existingGroups.map((group) => (
                <CommandItem key={group} value={group} onSelect={() => select(group)}>
                  <Check className={cn("size-4", value === group ? "opacity-100" : "opacity-0")} />
                  {group}
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem value={`criar-grupo-${trimmedSearch}`} onSelect={() => select(trimmedSearch)}>
                  <Tags className="size-4" />
                  Criar grupo "{trimmedSearch}"
                </CommandItem>
              )}
            </CommandGroup>
            {value && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem value="remover-do-grupo" onSelect={() => select(null)} className="text-destructive">
                    <X className="size-4" />
                    Remover do grupo
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
