import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useBackOverlay } from "@/lib/android/use-back-overlay";
import { cn } from "@/lib/cn";
import { nextReviewCardLabel, mistakeSubject } from "@/lib/study/error-notebook";
import type { Mistake } from "@/lib/study/types";
import { ERROR_REASON_LABEL } from "@/lib/study/types";

/**
 * Cartão compacto do caderno: assunto no título, trecho da questão em duas
 * linhas, chip do motivo e a data da próxima revisão. O toque abre o detalhe;
 * editar/excluir ficam no menu ⋮ de 48dp.
 */
export function MistakeCard({
  mistake,
  today,
  onOpen,
  onEdit,
  onDelete,
}: {
  mistake: Mistake;
  today: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const review = nextReviewCardLabel(mistake, today);

  return (
    <article className="relative rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col items-start gap-1.5 p-4 pr-14 text-left"
      >
        <span className="line-clamp-2 text-base font-semibold leading-snug text-fg">
          {mistakeSubject(mistake)}
        </span>
        <span className="line-clamp-2 text-sm leading-relaxed text-muted">{mistake.prompt}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {mistake.errorReason ? (
            <span className="inline-flex h-7 items-center rounded-full border border-border px-2 text-xs font-medium text-fg">
              {ERROR_REASON_LABEL[mistake.errorReason]}
            </span>
          ) : null}
          <span
            className={cn(
              "text-xs leading-snug",
              review === "Revisar hoje" ? "text-primary" : "text-muted",
            )}
          >
            {review}
          </span>
        </span>
      </button>

      <MistakeMenu onEdit={onEdit} onDelete={onDelete} />
    </article>
  );
}

function MistakeMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  // O voltar do Android fecha o menu antes de considerar o histórico.
  useBackOverlay(open, () => setOpen(false));

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Ações do erro"
          className="absolute right-1 top-1 grid size-12 place-items-center rounded-full text-fg transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2"
        >
          <MoreVertical className="size-5" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          aria-label="Ações do erro"
          className="z-50 min-w-44 rounded-xl border border-border bg-surface-2 p-1 shadow-xl"
        >
          <DropdownMenu.Item
            onSelect={onEdit}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-fg outline-none data-[highlighted]:bg-surface"
          >
            <Pencil className="size-5 shrink-0" aria-hidden />
            Editar
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onDelete}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-clay-text outline-none data-[highlighted]:bg-clay/10"
          >
            <Trash2 className="size-5 shrink-0" aria-hidden />
            Excluir
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
