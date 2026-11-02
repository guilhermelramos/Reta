import { X } from "lucide-react";
import { Drawer } from "vaul";
import { ErrorReasonPicker } from "@/components/mistake-reason";
import { Button } from "@/components/ui/button";
import { useBackOverlay } from "@/lib/android/use-back-overlay";
import { mistakeSourceLabel, mistakeSubject, mistakeSubtopic } from "@/lib/study/error-notebook";
import { reviewStatusLabel } from "@/lib/study/srs";
import { formatShortDate } from "@/lib/study/time";
import type { ErrorReason, Mistake } from "@/lib/study/types";

/**
 * Detalhe de um erro: conteúdo completo, classificação editável e as duas
 * ações que já existiam (revisar agora e perguntar ao Professor).
 */
export function MistakeDetailSheet({
  mistake,
  today,
  onClose,
  onReview,
  onAsk,
  onReason,
}: {
  mistake: Mistake | null;
  today: string;
  onClose: () => void;
  onReview: () => void;
  onAsk: () => void;
  onReason: (reason: ErrorReason | undefined) => void;
}) {
  useBackOverlay(Boolean(mistake), onClose);

  return (
    <Drawer.Root
      open={Boolean(mistake)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[55] bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-t-[28px] border border-border bg-surface">
          <Drawer.Handle className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-border" />
          {mistake ? (
            <>
              <div className="flex items-start justify-between gap-3 px-5 pt-2">
                <div className="min-w-0">
                  <Drawer.Title className="text-2xl leading-snug">
                    {mistakeSubject(mistake)}
                  </Drawer.Title>
                  <Drawer.Description className="mt-1 text-xs leading-relaxed text-muted">
                    {formatShortDate(mistake.date)} · {mistakeSourceLabel(mistake, false)} ·{" "}
                    {reviewStatusLabel(mistake, today)}
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

              <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))]">
                {mistakeSubtopic(mistake) ? (
                  <p className="text-sm leading-relaxed text-muted">{mistakeSubtopic(mistake)}</p>
                ) : null}
                <p className="text-base leading-relaxed text-fg">{mistake.prompt}</p>

                {mistake.source === "externo" && (mistake.marked || mistake.answerKey) ? (
                  <p className="text-sm leading-relaxed text-muted">
                    {mistake.marked ? `Marquei: ${mistake.marked}` : ""}
                    {mistake.marked && mistake.answerKey ? " · " : ""}
                    {mistake.answerKey ? `Gabarito: ${mistake.answerKey}` : ""}
                  </p>
                ) : null}

                {mistake.source !== "externo" ? (
                  <div className="flex flex-col gap-1 text-sm leading-relaxed">
                    <p className="text-fg">Certa: {mistake.choices[mistake.correctIndex] ?? "—"}</p>
                    <p className="text-muted">
                      Sua tentativa: {mistake.choices[mistake.userIndex] ?? "—"}
                    </p>
                    {mistake.explanation ? (
                      <p className="mt-1 text-muted">{mistake.explanation}</p>
                    ) : null}
                  </div>
                ) : null}

                <ErrorReasonPicker
                  className="mt-1"
                  label="Motivo do erro"
                  value={mistake.errorReason}
                  allowClear
                  onChange={onReason}
                  onClear={() => onReason(undefined)}
                />

                <div className="mt-2 flex flex-col gap-2">
                  <Button variant="tonal" className="w-full" onClick={onReview}>
                    Revisar agora
                  </Button>
                  <Button variant="surface" className="w-full" onClick={onAsk}>
                    Perguntar ao Professor IA
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
