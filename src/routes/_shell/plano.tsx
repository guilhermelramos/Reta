import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { InlineError } from "@/components/feedback/inline-error";
import { PlanDaySheet } from "@/components/plan/day-detail-sheet";
import { PlanDayForm } from "@/components/plan/day-form";
import { PlanDayRow } from "@/components/plan/day-row";
import { PlanMenu } from "@/components/plan/plan-menu";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { ErrorCopy } from "@/lib/feedback/error-copy";
import { recalculateSchedule } from "@/lib/study/flow";
import type { RecalculateResult, ScheduleMoveMode } from "@/lib/study/flow";
import {
  buildDayFromDraft,
  dayDraftFromDay,
  newDayDraft,
  type DayDraft,
} from "@/lib/study/plan-draft";
import {
  dayMonth,
  groupDaysByWeek,
  overdueDays,
  overdueLabel,
  planHeaderLine,
} from "@/lib/study/plan-schedule";
import { useStudy } from "@/lib/study/store";
import { weekKey } from "@/lib/study/today";
import { formatMin, formatShortDate, saoPauloToday, topicLine } from "@/lib/study/time";
import { KIND_LABEL } from "@/lib/study/types";
import type { PlanDay } from "@/lib/study/types";

export const Route = createFileRoute("/_shell/plano")({
  head: () => ({ meta: [{ title: "Plano · Reta" }] }),
  component: PlanPage,
});

const MOVE_LABEL: Record<ScheduleMoveMode, string> = {
  "bloco-b": "Bloco B livre",
  revisao: "Dia de revisão",
  fila: "Fila empurrada",
};

function localError(message: string): ErrorCopy {
  return { kind: "unknown", title: "Não deu para concluir", message };
}

const EMPTY_PLAN: ErrorCopy = {
  kind: "sheet",
  title: "Nenhum dia no plano",
  message:
    "Importe uma planilha .xlsx com a Data, o Bloco A, o Bloco B e a Revisão, ou restaure um backup em Ajustes.",
};

function PlanPage() {
  const { days, sessions, sheetName, importDays, upsertDay, removeDay } = useStudy();
  const today = useMemo(() => saoPauloToday(), []);

  /** Dia aberto na folha de detalhe (null = lista). */
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<DayDraft | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RecalculateResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [deleteDate, setDeleteDate] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  const todaySectionRef = useRef<HTMLElement>(null);
  const todayScrolled = useRef(false);
  const todayWeek = weekKey(today);

  const selected = openDate ? (days.find((day) => day.date === openDate) ?? null) : null;
  const deleteTarget = deleteDate ? (days.find((day) => day.date === deleteDate) ?? null) : null;
  const dateTaken = draft?.mode === "new" && days.some((day) => day.date === draft.date);

  const weeks = useMemo(() => groupDaysByWeek(days), [days]);
  const lateDays = useMemo(() => overdueDays(days, sessions, today), [days, sessions, today]);
  const headerLine = planHeaderLine({ days, sheetName });
  const lastPlanned = useMemo(
    () => days.reduce<string | null>((max, day) => (max && max > day.date ? max : day.date), null),
    [days],
  );

  // O dia de hoje precisa estar à vista ao abrir a tela, mesmo no meio de um
  // plano de 90 dias. Rola até a semana dele (o dia aparece logo abaixo do
  // cabeçalho) e só uma vez por montagem; depois a lista manda.
  useEffect(() => {
    if (todayScrolled.current) return;
    if (!days.some((day) => day.date === today)) return;
    const frame = requestAnimationFrame(() => {
      todaySectionRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      todayScrolled.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [days, today]);

  // Ao abrir o formulário de baixo da lista, sobe até ele. O atraso espera a
  // folha de detalhe fechar e devolver o foco ao gatilho.
  useEffect(() => {
    if (!formVersion) return;
    const timer = window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [formVersion]);

  function startNew() {
    setError(null);
    setNotice("");
    setPreview(null);
    setOpenDate(null);
    setDraft(newDayDraft(today));
    setFormVersion((version) => version + 1);
  }

  function startEdit(day: PlanDay) {
    setError(null);
    setNotice("");
    setPreview(null);
    setOpenDate(null);
    setDraft(dayDraftFromDay(day));
    setFormVersion((version) => version + 1);
  }

  function cancel() {
    setDraft(null);
    setError(null);
  }

  async function save() {
    if (!draft) return;
    setError(null);
    const result = buildDayFromDraft(draft);
    if (!result.ok) {
      setError(localError(result.error));
      return;
    }
    setBusy(true);
    try {
      const date = result.day.date;
      await upsertDay(result.day);
      setDraft(null);
      setNotice(`Dia ${dayMonth(date)} salvo neste aparelho.`);
    } catch {
      setError(localError("Não consegui salvar neste aparelho. Tente de novo."));
    } finally {
      setBusy(false);
    }
  }

  /** Monta o novo plano em memória e mostra o resumo; nada é gravado ainda. */
  function startRecalculate() {
    setError(null);
    setNotice("");
    const result = recalculateSchedule(days, today, sessions);
    if (!result.moves.length) {
      setPreview(null);
      setNotice(
        result.summary.overdue === 0
          ? "Nenhum bloco atrasado: a Reta está em dia."
          : "Os atrasados já tinham sido reagendados. Nada novo para mover.",
      );
      return;
    }
    setPreview(result);
  }

  async function applyRecalculate() {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      const moved = preview.moves.length;
      const minutes = formatMin(preview.summary.minutes);
      await importDays(preview.days);
      setPreview(null);
      setNotice(
        moved === 1
          ? `1 bloco reagendado (${minutes}). A Reta foi atualizada.`
          : `${moved} blocos reagendados (${minutes}). A Reta foi atualizada.`,
      );
    } catch {
      setError(localError("Não consegui salvar o novo plano neste aparelho. Tente de novo."));
    } finally {
      setApplying(false);
    }
  }

  function requestDelete(day: PlanDay) {
    setOpenDate(null);
    setError(null);
    setNotice("");
    setDeleteDate(day.date);
  }

  async function confirmDelete() {
    if (!deleteDate) return;
    setDeleting(true);
    try {
      const date = deleteDate;
      await removeDay(date);
      setError(null);
      setNotice(`Dia ${dayMonth(date)} excluído do plano.`);
    } catch {
      setError(localError("Não consegui excluir este dia. Tente de novo."));
    } finally {
      setDeleting(false);
      setDeleteDate(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-3">
      <header className="sticky top-0 z-20 flex items-start justify-between gap-2 bg-bg/95 py-2 backdrop-blur">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight">Plano</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">{headerLine}</p>
        </div>
        <PlanMenu
          canCreateDay={!draft && !busy && !applying}
          canRecalculate={!draft && !busy && !applying && days.length > 0}
          onNewDay={startNew}
          onRecalculate={startRecalculate}
        />
      </header>

      {notice ? (
        <p role="status" aria-live="polite" className="text-sm leading-relaxed text-fg">
          {notice}
        </p>
      ) : null}

      {error && !draft ? <InlineError copy={error} /> : null}

      {preview ? (
        <RecalculatePreview
          preview={preview}
          applying={applying}
          lastPlanned={lastPlanned}
          onCancel={() => setPreview(null)}
          onApply={() => void applyRecalculate()}
        />
      ) : lateDays.length ? (
        <section className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-clay-text" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-xl leading-snug">{overdueLabel(lateDays.length)}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Blocos de dias passados ainda não concluídos. O recálculo mostra o efeito antes de
              aplicar.
            </p>
            <Button
              variant="tonal"
              className="mt-3"
              onClick={startRecalculate}
              disabled={Boolean(draft) || busy || applying}
            >
              <RefreshCw className="size-5" aria-hidden />
              Recalcular
            </Button>
          </div>
        </section>
      ) : null}

      {draft ? (
        <div ref={formRef} className="scroll-mt-24">
          <PlanDayForm
            draft={draft}
            error={error}
            busy={busy}
            dateTaken={Boolean(dateTaken)}
            onChange={setDraft}
            onSave={() => void save()}
            onCancel={cancel}
          />
        </div>
      ) : null}

      {days.length ? (
        <div className="mt-1 flex flex-col gap-4">
          {weeks.map((week) => (
            <section
              key={week.start}
              ref={week.start === todayWeek ? todaySectionRef : undefined}
              aria-labelledby={`plan-week-${week.start}`}
              className="flex scroll-mt-24 flex-col gap-2"
            >
              <h2
                id={`plan-week-${week.start}`}
                className="py-1 font-sans text-sm font-medium text-muted"
              >
                {week.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {week.days.map((day) => (
                  <li key={day.date}>
                    <PlanDayRow
                      day={day}
                      sessions={sessions}
                      today={today}
                      onOpen={() => {
                        setError(null);
                        setNotice("");
                        setOpenDate(day.date);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ErrorState copy={EMPTY_PLAN} />
      )}

      <PlanDaySheet
        day={selected}
        sessions={sessions}
        onClose={() => setOpenDate(null)}
        onEdit={() => {
          if (selected) startEdit(selected);
        }}
        onDelete={() => {
          if (selected) requestDelete(selected);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir dia?"
        description={
          deleteDate
            ? `O plano de ${dayMonth(deleteDate)} será removido deste aparelho. As sessões já registradas continuam.`
            : ""
        }
        confirmLabel="Excluir"
        busy={deleting}
        onCancel={() => setDeleteDate(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function RecalculatePreview({
  preview,
  applying,
  lastPlanned,
  onCancel,
  onApply,
}: {
  preview: RecalculateResult;
  applying: boolean;
  lastPlanned: string | null;
  onCancel: () => void;
  onApply: () => void;
}) {
  return (
    <section className="rounded-xl border border-primary/40 bg-surface p-4" aria-live="polite">
      <h2 className="text-2xl">Recalcular atrasados</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {preview.summary.overdue}{" "}
        {preview.summary.overdue === 1 ? "bloco atrasado" : "blocos atrasados"} ·{" "}
        {formatMin(preview.summary.minutes)} para encaixar · {preview.summary.daysTouched}{" "}
        {preview.summary.daysTouched === 1 ? "dia recebe" : "dias recebem"} conteúdo.{" "}
        {preview.summary.lastDate
          ? `A reta vai até ${formatShortDate(preview.summary.lastDate)} `
          : ""}
        Nada muda até você confirmar.
      </p>
      <ul className="mt-3 flex max-h-72 flex-col gap-2 overflow-auto pr-1">
        {preview.moves.map((move, index) => (
          <li
            key={`${move.fromDate}:${move.fromKind}:${index}`}
            className="rounded-lg border border-border bg-surface-2/50 p-3 text-sm"
          >
            <p className="text-xs font-medium text-primary">{MOVE_LABEL[move.mode]}</p>
            <p className="mt-1 leading-relaxed">
              {KIND_LABEL[move.fromKind]} de {formatShortDate(move.fromDate)} →{" "}
              {KIND_LABEL[move.toKind]} em {formatShortDate(move.toDate)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {topicLine(move.content, 120)} · {formatMin(move.minutes)}
            </p>
          </li>
        ))}
      </ul>
      {preview.summary.lastDate && lastPlanned && preview.summary.lastDate > lastPlanned ? (
        <p className="mt-3 rounded-lg bg-clay/10 px-3 py-2 text-xs leading-relaxed text-clay-text">
          A reta esticou até {formatShortDate(preview.summary.lastDate)} para caber os atrasados.
          Confira os dias que ficaram depois da prova.
        </p>
      ) : null}
      {preview.summary.skipped > 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {preview.summary.skipped}{" "}
          {preview.summary.skipped === 1 ? "atrasado já tinha" : "atrasados já tinham"} sido
          reagendado antes e não entram de novo.
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={applying}>
          Cancelar
        </Button>
        <Button onClick={onApply} disabled={applying}>
          {applying ? "Aplicando…" : "Aplicar mudanças"}
        </Button>
      </div>
    </section>
  );
}
