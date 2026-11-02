import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, CircleDot, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { useBackOverlay } from "@/lib/android/use-back-overlay";
import { cn } from "@/lib/cn";
import { blockState } from "@/lib/study/today";
import { dayLoad, formatLongDate, formatMin } from "@/lib/study/time";
import type { BlockKind, PlanDay, StudySession } from "@/lib/study/types";
import { KIND_LABEL } from "@/lib/study/types";

const BLOCK_STATE_LABEL = {
  idle: "Pendente",
  active: "Em andamento",
  done: "Concluído",
} as const;

const BLOCK_STATE_ICON = {
  idle: Circle,
  active: CircleDot,
  done: CheckCircle2,
} as const;

/**
 * Detalhe do dia em bottom sheet M3: blocos com minutos, escolha do bloco e
 * as ações que já existiam (estudar, editar e excluir). "Estudar este bloco"
 * é o único botão preenchido da folha; os demais são tonal/texto.
 */
export function PlanDaySheet({
  day,
  sessions,
  onClose,
  onEdit,
  onDelete,
}: {
  day: PlanDay | null;
  sessions: readonly StudySession[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // A escolha vale para o dia aberto; ao trocar de dia ela volta ao primeiro
  // bloco com carga, sem precisar de efeito.
  const [picked, setPicked] = useState<{ date: string; kind: BlockKind } | null>(null);
  useBackOverlay(Boolean(day), onClose);

  const pickedKind = day && picked?.date === day.date ? picked.kind : null;
  const chosen = day
    ? (day.blocks.find((block) => block.kind === pickedKind && block.plannedMin > 0) ??
      day.blocks.find((block) => block.plannedMin > 0) ??
      null)
    : null;

  return (
    <Drawer.Root
      open={Boolean(day)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[55] bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-border bg-surface">
          <Drawer.Handle className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-border" />
          {day ? (
            <>
              {/* Cabeçalho fixo: fica fora da região rolável. */}
              <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-2">
                <div className="min-w-0">
                  <Drawer.Title className="text-2xl leading-snug">
                    {formatLongDate(day.date)}
                  </Drawer.Title>
                  <Drawer.Description className="mt-1 text-sm leading-relaxed text-muted">
                    {day.phase || "Dia de estudo"} ·{" "}
                    {dayLoad(day) > 0 ? formatMin(dayLoad(day)) : "Sem carga"}
                  </Drawer.Description>
                </div>
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={onClose}
                  className="grid size-12 shrink-0 place-items-center rounded-full text-fg transition-colors hover:bg-surface-2"
                >
                  <X className="size-6" aria-hidden />
                </button>
              </div>

              {/* Corpo rolável: só os blocos. */}
              <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3">
                {day.blocks.length ? (
                  <div className="flex flex-col gap-2" role="group" aria-label="Blocos do dia">
                    {day.blocks.map((block) => {
                      const state = blockState(sessions, day.date, block.kind);
                      const StateIcon = BLOCK_STATE_ICON[state];
                      const active = chosen?.kind === block.kind;
                      return (
                        <button
                          key={block.kind}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setPicked({ date: day.date, kind: block.kind })}
                          className={cn(
                            "flex min-h-[64px] w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                            active
                              ? "border-primary bg-primary-tonal"
                              : "border-border bg-surface-2/40 hover:bg-surface-2",
                          )}
                        >
                          <StateIcon
                            className={cn(
                              "mt-0.5 size-5 shrink-0",
                              state === "idle" ? "text-muted" : "text-primary",
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                                {KIND_LABEL[block.kind]}
                              </span>
                              <span className="text-xs tabular-nums text-muted">
                                {block.plannedMin > 0 ? formatMin(block.plannedMin) : "Sem tempo"}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-sm leading-relaxed text-fg">
                              {block.content || "Sem tópico"}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">
                              {BLOCK_STATE_LABEL[state]}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm leading-relaxed text-muted">
                    Dia sem blocos. Use{" "}
                    <strong className="font-semibold text-fg">Editar dia</strong> para preencher.
                  </p>
                )}
              </div>

              {/* Rodapé fixo: as três ações nunca ficam abaixo da dobra. */}
              <div className="plan-sheet-actions shrink-0 border-t border-border px-5 pb-[calc(1rem_+_env(safe-area-inset-bottom))] pt-3">
                {chosen ? (
                  <Button asChild className="w-full">
                    <Link
                      to="/sessao"
                      search={{ dia: day.date, bloco: chosen.kind, modo: "cheio", auto: 1 }}
                    >
                      Estudar este bloco
                    </Link>
                  </Button>
                ) : (
                  <Button className="w-full" disabled>
                    Estudar este bloco
                  </Button>
                )}
                <Button variant="tonal" className="w-full" onClick={onEdit}>
                  Editar dia
                </Button>
                <Button variant="ghost" className="w-full text-clay-text" onClick={onDelete}>
                  <Trash2 className="size-5" aria-hidden />
                  Excluir dia
                </Button>
              </div>
            </>
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
