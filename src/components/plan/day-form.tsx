import { Plus, Trash2 } from "lucide-react";
import { InlineError } from "@/components/feedback/inline-error";
import { Button } from "@/components/ui/button";
import type { ErrorCopy } from "@/lib/feedback/error-copy";
import {
  BLOCK_KINDS,
  emptyDraftBlock,
  type DayDraft,
  type DraftBlock,
} from "@/lib/study/plan-draft";
import type { BlockKind } from "@/lib/study/types";
import { KIND_LABEL } from "@/lib/study/types";
import { cn } from "@/lib/cn";

const FIELD =
  "min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-muted disabled:opacity-70";

const LABEL = "text-sm font-medium text-fg";

/**
 * Formulário Novo/Editar dia. Campos de 48dp com label, minutos com teclado
 * numérico e o Salvar como único botão preenchido da tela.
 */
export function PlanDayForm({
  draft,
  error,
  busy,
  dateTaken,
  onChange,
  onSave,
  onCancel,
}: {
  draft: DayDraft;
  error: ErrorCopy | null;
  busy: boolean;
  dateTaken: boolean;
  onChange: (next: DayDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const used = draft.blocks.map((block) => block.kind);
  const nextKind = BLOCK_KINDS.find((kind) => !used.includes(kind));

  function patchBlock(key: string, patch: Partial<DraftBlock>) {
    onChange({
      ...draft,
      blocks: draft.blocks.map((block) => (block.key === key ? { ...block, ...patch } : block)),
    });
  }

  function removeBlock(key: string) {
    if (draft.blocks.length <= 1) return;
    onChange({ ...draft, blocks: draft.blocks.filter((block) => block.key !== key) });
  }

  function addBlock() {
    if (!nextKind) return;
    onChange({ ...draft, blocks: [...draft.blocks, emptyDraftBlock(nextKind)] });
  }

  return (
    <form
      className="rounded-xl border border-primary/40 bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <h2 className="text-2xl">{draft.mode === "new" ? "Novo dia" : "Editar dia"}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {draft.mode === "new"
          ? "Preencha o dia e os blocos. Fica salvo só neste aparelho."
          : "Ajuste o tópico e os minutos. As sessões já feitas continuam registradas."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="plan-date" className={LABEL}>
            Data
          </label>
          <input
            id="plan-date"
            type="date"
            required
            value={draft.date}
            disabled={draft.mode === "edit"}
            onChange={(event) => onChange({ ...draft, date: event.target.value })}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="plan-phase" className={LABEL}>
            Fase / nome do dia
          </label>
          <input
            id="plan-phase"
            type="text"
            value={draft.phase}
            onChange={(event) => onChange({ ...draft, phase: event.target.value })}
            placeholder="Opcional — ex.: Semana 3 · Revisão"
            className={FIELD}
          />
        </div>
      </div>

      {dateTaken ? (
        <p role="status" className="mt-2 text-xs leading-relaxed text-clay-text">
          Já existe plano nessa data. Salvar substitui o conteúdo atual do dia.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        {draft.blocks.map((block, index) => (
          <fieldset key={block.key} className="rounded-xl border border-border bg-surface-2/40 p-3">
            <legend className="px-1 text-xs text-muted">Bloco {index + 1}</legend>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor={`plan-kind-${block.key}`} className={LABEL}>
                  Tipo
                </label>
                <select
                  id={`plan-kind-${block.key}`}
                  value={block.kind}
                  onChange={(event) =>
                    patchBlock(block.key, { kind: event.target.value as BlockKind })
                  }
                  className={FIELD}
                >
                  {BLOCK_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABEL[kind]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`plan-min-${block.key}`} className={LABEL}>
                  Minutos
                </label>
                <input
                  id={`plan-min-${block.key}`}
                  type="text"
                  inputMode="numeric"
                  value={block.minutes}
                  onChange={(event) => patchBlock(block.key, { minutes: event.target.value })}
                  placeholder="45 · 1h30"
                  className={FIELD}
                />
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <label htmlFor={`plan-topic-${block.key}`} className={LABEL}>
                Tópico
              </label>
              <textarea
                id={`plan-topic-${block.key}`}
                value={block.content}
                onChange={(event) => patchBlock(block.key, { content: event.target.value })}
                rows={2}
                placeholder="Ex.: Matemática: progressão aritmética — soma e termo geral"
                className={cn(
                  "min-h-16 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted",
                )}
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                className="text-clay-text"
                onClick={() => removeBlock(block.key)}
                disabled={draft.blocks.length <= 1}
                aria-label={`Remover bloco ${index + 1}`}
              >
                <Trash2 className="size-5" aria-hidden />
                Remover
              </Button>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-3">
        <Button variant="surface" onClick={addBlock} disabled={!nextKind}>
          <Plus className="size-5" aria-hidden />
          {nextKind ? `Adicionar ${KIND_LABEL[nextKind]}` : "Todos os blocos já estão no dia"}
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Nos minutos, vale 45, 1h30, 01:30 ou 90. Deixe em branco para um bloco sem tempo marcado.
        Blocos sem tópico não são salvos.
      </p>

      {error ? <InlineError className="mt-3" copy={error} /> : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Salvando…" : "Salvar dia"}
        </Button>
      </div>
    </form>
  );
}
