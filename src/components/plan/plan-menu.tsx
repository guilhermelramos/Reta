import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Link } from "@tanstack/react-router";
import { FileUp, MoreVertical, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useBackOverlay } from "@/lib/android/use-back-overlay";

/** Item de 48dp; o foco do teclado usa o realce de 8% do Radix. */
const ITEM =
  "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm text-fg outline-none data-[highlighted]:bg-surface data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

/**
 * Menu ⋮ do topo do Plano. "Trocar planilha" navega; "Novo dia" e
 * "Recalcular atrasados" continuam existindo aqui mesmo quando o cartão de
 * aviso de atrasados não aparece.
 */
export function PlanMenu({
  canCreateDay,
  canRecalculate,
  onNewDay,
  onRecalculate,
}: {
  canCreateDay: boolean;
  canRecalculate: boolean;
  onNewDay: () => void;
  onRecalculate: () => void;
}) {
  const [open, setOpen] = useState(false);
  // O voltar do Android fecha o menu antes de considerar o histórico.
  useBackOverlay(open, () => setOpen(false));

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Ações do plano"
          className="no-print grid size-12 shrink-0 place-items-center rounded-full text-fg transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2"
        >
          <MoreVertical className="size-6" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          aria-label="Ações do plano"
          className="no-print z-50 min-w-60 rounded-xl border border-border bg-surface-2 p-1 shadow-xl"
        >
          <DropdownMenu.Item asChild>
            <Link to="/importar" className={ITEM}>
              <FileUp className="size-5 shrink-0" aria-hidden />
              Trocar planilha
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!canCreateDay}
            onSelect={() => window.setTimeout(onNewDay, 0)}
            className={ITEM}
          >
            <Plus className="size-5 shrink-0" aria-hidden />
            Novo dia
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!canRecalculate}
            onSelect={() => window.setTimeout(onRecalculate, 0)}
            className={ITEM}
          >
            <RefreshCw className="size-5 shrink-0" aria-hidden />
            Recalcular atrasados
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
