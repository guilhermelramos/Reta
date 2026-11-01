import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/lib/study/store";
import { dayLoad, formatLongDate, formatMin, formatShortDate, formatWeekday, parseDuration, saoPauloToday, topicLine } from "@/lib/study/time";
import { KIND_LABEL } from "@/lib/study/types";
import type { BlockKind, PlanBlock, PlanDay } from "@/lib/study/types";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_shell/plano")({
  head: () => ({ meta: [{ title: "Plano · Reta" }] }),
  component: PlanPage,
});

const KINDS: BlockKind[] = ["A", "B", "R", "L"];

type DraftBlock = { key: string; kind: BlockKind; content: string; minutes: string };

/** Dia em edição (novo ou existente), com os blocos ainda como texto. */
type DayDraft = {
  mode: "edit" | "new";
  date: string;
  phase: string;
  blocks: DraftBlock[];
};

let draftSeq = 0;
function draftKey(): string {
  draftSeq += 1;
  return `draft-${draftSeq}`;
}

function emptyBlock(kind: BlockKind): DraftBlock {
  return { key: draftKey(), kind, content: "", minutes: "60" };
}

function PlanPage() {
  const { days, sessions, upsertDay } = useStudy();
  const today = saoPauloToday();
  const [open, setOpen] = useState(today);
  const [draft, setDraft] = useState<DayDraft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = days.find((d) => d.date === open) ?? days.find((d) => d.date >= today) ?? days[0];
  const dateTaken = draft?.mode === "new" && days.some((d) => d.date === draft.date);

  function startNew() {
    setError("");
    setNotice("");
    setDraft({
      mode: "new",
      date: today,
      phase: "",
      blocks: [emptyBlock("A"), emptyBlock("B")],
    });
  }

  function startEdit(day: PlanDay) {
    setError("");
    setNotice("");
    setOpen(day.date);
    setDraft({
      mode: "edit",
      date: day.date,
      phase: day.phase ?? "",
      blocks: day.blocks.length
        ? day.blocks.map((block) => ({
            key: draftKey(),
            kind: block.kind,
            content: block.content,
            minutes: block.plannedMin > 0 ? String(block.plannedMin) : "",
          }))
        : [emptyBlock("A")],
    });
  }

  function cancel() {
    setDraft(null);
    setError("");
  }

  async function save() {
    if (!draft) return;
    setError("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      setError("Escolha uma data válida.");
      return;
    }
    const blocks: PlanBlock[] = [];
    const seen = new Set<BlockKind>();
    for (const row of draft.blocks) {
      const content = row.content.replace(/\s+/g, " ").trim();
      const raw = row.minutes.trim();
      const plannedMin = raw === "" ? 0 : parseDuration(raw);
      if (plannedMin == null) {
        setError(`Minutos de ${KIND_LABEL[row.kind]} inválidos. Use 45, 1h30 ou 01:30.`);
        return;
      }
      if (!content) continue;
      if (seen.has(row.kind)) {
        setError(`${KIND_LABEL[row.kind]} está repetido. Cada bloco aparece uma vez por dia.`);
        return;
      }
      seen.add(row.kind);
      blocks.push({ kind: row.kind, content, plannedMin });
    }
    if (!blocks.length) {
      setError("Preencha o tópico de pelo menos um bloco.");
      return;
    }
    setBusy(true);
    try {
      const date = draft.date;
      await upsertDay({ date, phase: draft.phase.trim(), blocks });
      setOpen(date);
      setDraft(null);
      setNotice(`Dia ${formatShortDate(date)} salvo neste aparelho.`);
    } catch {
      setError("Não consegui salvar neste aparelho. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Plano</h1>
          <p className="mt-2 text-sm text-muted">{days.length} dias. A revisão é a da planilha — o app não inventa outra agenda.</p>
        </div>
        <Button variant="surface" onClick={startNew} disabled={Boolean(draft) || busy}>
          <Plus className="size-4" aria-hidden /> Novo dia
        </Button>
      </header>

      {notice ? <p className="text-sm text-primary">{notice}</p> : null}

      {draft ? (
        <DayForm
          draft={draft}
          error={error}
          busy={busy}
          dateTaken={Boolean(dateTaken)}
          onChange={setDraft}
          onSave={() => void save()}
          onCancel={cancel}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ul className="flex max-h-96 flex-col gap-1 overflow-auto pr-1 md:max-h-screen">
          {days.map((day) => {
            const done = day.blocks.filter((b) => b.plannedMin > 0 && sessions.some((s) => s.date === day.date && s.kind === b.kind && s.status === "done")).length;
            const load = day.blocks.filter((b) => b.plannedMin > 0).length;
            const active = selected?.date === day.date;
            return (
              <li key={day.date}>
                <button
                  type="button"
                  onClick={() => setOpen(day.date)}
                  disabled={Boolean(draft)}
                  title={draft ? "Salve ou cancele a edição para trocar de dia" : undefined}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left disabled:opacity-60",
                    active ? "bg-surface-2" : "hover:bg-surface",
                    day.date === today && "ring-1 ring-primary/50",
                  )}
                >
                  <span>
                    <span className="text-xs uppercase text-muted">{formatWeekday(day.date)}</span>
                    <span className="ml-2">{formatShortDate(day.date)}</span>
                  </span>
                  <span className="text-xs text-muted">{dayLoad(day) ? `${done}/${load}` : "livre"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {selected ? (
          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted">{formatLongDate(selected.date)}</p>
                <h2 className="mt-1 text-2xl">{selected.phase || "Dia"}</h2>
                <p className="mt-1 text-sm text-muted">{formatMin(dayLoad(selected))}</p>
              </div>
              <Button variant="ghost" onClick={() => startEdit(selected)} disabled={Boolean(draft) || busy}>
                Editar
              </Button>
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {selected.blocks.length ? (
                selected.blocks.map((block) => (
                  <li key={block.kind} className="border-t border-border pt-3">
                    <p className="text-xs text-primary">{KIND_LABEL[block.kind]} · {formatMin(block.plannedMin)}</p>
                    <p className="mt-1 text-sm leading-relaxed">{block.content ? topicLine(block.content, 220) : "Sem tópico"}</p>
                    {block.plannedMin > 0 ? (
                      <Button className="mt-2" variant="surface" asChild>
                        <Link to="/sessao" search={{ dia: selected.date, bloco: block.kind, modo: "cheio", auto: 1 }}>Iniciar</Link>
                      </Button>
                    ) : null}
                  </li>
                ))
              ) : (
                <li className="border-t border-border pt-3 text-sm text-muted">Dia sem blocos — use “Editar” para preencher.</li>
              )}
            </ul>
          </section>
        ) : (
          <p className="text-muted">Nenhum dia importado.</p>
        )}
      </div>
    </div>
  );
}

function DayForm({
  draft,
  error,
  busy,
  dateTaken,
  onChange,
  onSave,
  onCancel,
}: {
  draft: DayDraft;
  error: string;
  busy: boolean;
  dateTaken: boolean;
  onChange: (next: DayDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const used = draft.blocks.map((block) => block.kind);
  const nextKind = KINDS.find((kind) => !used.includes(kind));

  function patchBlock(key: string, patch: Partial<DraftBlock>) {
    onChange({ ...draft, blocks: draft.blocks.map((block) => (block.key === key ? { ...block, ...patch } : block)) });
  }

  function removeBlock(key: string) {
    if (draft.blocks.length <= 1) return;
    onChange({ ...draft, blocks: draft.blocks.filter((block) => block.key !== key) });
  }

  function addBlock() {
    if (!nextKind) return;
    onChange({ ...draft, blocks: [...draft.blocks, emptyBlock(nextKind)] });
  }

  const fieldClass = "min-h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-muted/60";

  return (
    <form
      className="rounded-xl border border-primary/40 bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <h2 className="text-xl">{draft.mode === "new" ? "Novo dia" : "Editar dia"}</h2>
      <p className="mt-1 text-xs text-muted">
        {draft.mode === "new"
          ? "Preencha o dia e os blocos. Fica salvo só neste aparelho."
          : "Ajuste o tópico e os minutos. As sessões já feitas continuam registradas."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Data
          <input
            type="date"
            required
            value={draft.date}
            disabled={draft.mode === "edit"}
            onChange={(event) => onChange({ ...draft, date: event.target.value })}
            className={cn(fieldClass, "disabled:opacity-70")}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fase / nome do dia
          <input
            type="text"
            value={draft.phase}
            onChange={(event) => onChange({ ...draft, phase: event.target.value })}
            placeholder="Opcional — ex.: Semana 3 · Revisão"
            className={fieldClass}
          />
        </label>
      </div>

      {dateTaken ? (
        <p className="mt-2 text-xs text-clay-text">Já existe plano nessa data. Salvar substitui o conteúdo atual do dia.</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        {draft.blocks.map((block, index) => (
          <fieldset key={block.key} className="rounded-xl border border-border bg-surface-2/40 p-3">
            <legend className="px-1 text-xs uppercase text-muted">Bloco {index + 1}</legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-sm">
                Tipo
                <select
                  value={block.kind}
                  onChange={(event) => patchBlock(block.key, { kind: event.target.value as BlockKind })}
                  className={fieldClass}
                >
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Minutos
                <input
                  type="text"
                  inputMode="numeric"
                  value={block.minutes}
                  onChange={(event) => patchBlock(block.key, { minutes: event.target.value })}
                  placeholder="45 · 1h30"
                  className={fieldClass}
                />
              </label>
            </div>
            <label className="mt-2 flex flex-col gap-1 text-sm">
              Tópico
              <textarea
                value={block.content}
                onChange={(event) => patchBlock(block.key, { content: event.target.value })}
                rows={2}
                placeholder="Ex.: Matemática: progressão aritmética — soma e termo geral"
                className="min-h-16 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted/60"
              />
            </label>
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                className="text-clay-text"
                onClick={() => removeBlock(block.key)}
                disabled={draft.blocks.length <= 1}
                aria-label={`Remover bloco ${index + 1}`}
              >
                <Trash2 className="size-4" aria-hidden /> Remover
              </Button>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-3">
        <Button variant="surface" onClick={addBlock} disabled={!nextKind}>
          <Plus className="size-4" aria-hidden /> {nextKind ? `Adicionar ${KIND_LABEL[nextKind]}` : "Todos os blocos já estão no dia"}
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted">
        Nos minutos, vale 45, 1h30, 01:30 ou 90. Deixe em branco para um bloco sem tempo marcado. Blocos sem tópico não são salvos.
      </p>

      {error ? (
        <p role="alert" className="mt-2 rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay-text">{error}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar dia"}</Button>
      </div>
    </form>
  );
}
