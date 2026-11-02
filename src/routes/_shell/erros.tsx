import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NotebookFilterChips } from "@/components/erros/filter-chips";
import { MistakeCard } from "@/components/erros/mistake-card";
import { MistakeDetailSheet } from "@/components/erros/mistake-detail-sheet";
import { MistakeFormSheet, type MistakeDraft } from "@/components/erros/mistake-form-sheet";
import { InlineError } from "@/components/feedback/inline-error";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { TeacherChat } from "@/components/teacher-chat";
import { Button } from "@/components/ui/button";
import type { ErrorCopy } from "@/lib/feedback/error-copy";
import { useBackOverlay } from "@/lib/android/use-back-overlay";
import {
  clearNotebookFilters,
  DELETE_MISTAKE_BODY,
  DELETE_MISTAKE_TITLE,
  emptyListMessage,
  hasActiveFilters,
  isNotebookEmpty,
  mistakeSourceLabel,
  nextReviewDate,
  nextReviewLabel,
  notebookCounts,
  notebookList,
  notebookReasons,
  notebookSubjects,
  notebookSummary,
  outcomeIntervalLabel,
  reviewProgressLabel,
  reviewProgressPercent,
  SRS_OUTCOME_SHORT_LABEL,
  DEFAULT_NOTEBOOK_FILTERS,
  type NotebookFilters,
} from "@/lib/study/error-notebook";
import {
  newMistakeSrs,
  reviewStatusLabel,
  SRS_OUTCOME_LABEL,
  type SrsOutcome,
} from "@/lib/study/srs";
import { useStudy } from "@/lib/study/store";
import { formatClock, formatShortDate, saoPauloToday } from "@/lib/study/time";
import { ERROR_REASON_LABEL, KIND_LABEL } from "@/lib/study/types";
import type { Mistake } from "@/lib/study/types";

export const Route = createFileRoute("/_shell/erros")({
  head: () => ({ meta: [{ title: "Erros · Reta" }] }),
  component: ErrorsPage,
});

type SheetState = { mode: "create" } | { mode: "edit"; id: string };

function localError(message: string): ErrorCopy {
  return { kind: "unknown", title: "Não deu para concluir", message };
}

function draftFromMistake(mistake: Mistake): MistakeDraft {
  return {
    subject: mistake.subject ?? "",
    topic: mistake.topic ?? "",
    prompt: mistake.prompt,
    marked: mistake.marked ?? "",
    answerKey: mistake.answerKey ?? "",
    reason: mistake.errorReason ?? "",
  };
}

function ErrorsPage() {
  const study = useStudy();
  const today = useMemo(() => saoPauloToday(), []);

  const [filters, setFilters] = useState<NotebookFilters>(DEFAULT_NOTEBOOK_FILTERS);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pageError, setPageError] = useState<ErrorCopy | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  const [review, setReview] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const [left, setLeft] = useState(5 * 60);

  // Voltar do Android durante a revisão volta ao caderno, sem sair da rota.
  useBackOverlay(review, () => setReview(false));

  const counts = useMemo(() => notebookCounts(study.mistakes, today), [study.mistakes, today]);
  const dueList = useMemo(
    () => notebookList(study.mistakes, { ...DEFAULT_NOTEBOOK_FILTERS, status: "vencidos" }, today),
    [study.mistakes, today],
  );
  const list = useMemo(
    () => notebookList(study.mistakes, filters, today),
    [study.mistakes, filters, today],
  );
  const emptyNotebook = isNotebookEmpty(counts);
  const nextDate = useMemo(() => nextReviewDate(study.mistakes, today), [study.mistakes, today]);
  const subjects = useMemo(() => notebookSubjects(study.mistakes), [study.mistakes]);
  const reasons = useMemo(() => notebookReasons(study.mistakes), [study.mistakes]);

  const detail = detailId ? (study.mistakes.find((m) => m.id === detailId) ?? null) : null;
  const editing =
    sheet?.mode === "edit" ? (study.mistakes.find((m) => m.id === sheet.id) ?? null) : null;
  const deleteItem = deleteId ? (study.mistakes.find((m) => m.id === deleteId) ?? null) : null;
  const item = queue[index] ? (study.mistakes.find((m) => m.id === queue[index]) ?? null) : null;
  const chatItem = chatId ? (study.mistakes.find((m) => m.id === chatId) ?? null) : null;

  useEffect(() => {
    if (!review) return;
    const id = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [review]);

  function startReview(ids: string[]) {
    if (!ids.length) return;
    setQueue(ids);
    setIndex(0);
    setShow(false);
    setLeft(5 * 60);
    setDetailId(null);
    setSheet(null);
    setReview(true);
  }

  async function answer(outcome: SrsOutcome) {
    if (!item) return;
    await study.reviewMistakeSrs(item.id, outcome, today);
    setShow(false);
    setIndex((n) => n + 1);
  }

  async function saveNew(draft: MistakeDraft): Promise<ErrorCopy | null> {
    const subject = draft.subject.trim();
    const topic = draft.topic.trim();
    const mistake: Mistake = {
      id: crypto.randomUUID(),
      sessionId: "externo",
      date: today,
      kind: "A",
      topic: [subject, topic].filter(Boolean).join(" · ") || "Erro externo",
      prompt: draft.prompt.trim(),
      choices: [],
      correctIndex: -1,
      userIndex: -1,
      explanation: "",
      createdAt: Date.now(),
      ...newMistakeSrs(today),
      source: "externo",
      subject: subject || undefined,
      marked: draft.marked.trim() || undefined,
      answerKey: draft.answerKey.trim() || undefined,
      errorReason: draft.reason || undefined,
    };
    try {
      await study.addMistake(mistake);
      setFilters(clearNotebookFilters());
      setPageError(null);
      setSheet(null);
      return null;
    } catch {
      return localError("Não consegui salvar este erro no aparelho. Tente de novo.");
    }
  }

  async function saveEdit(id: string, draft: MistakeDraft): Promise<ErrorCopy | null> {
    const subject = draft.subject.trim();
    const topic = draft.topic.trim();
    try {
      await study.updateMistake(id, {
        subject: subject || undefined,
        topic: topic || undefined,
        prompt: draft.prompt.trim(),
        marked: draft.marked.trim() || undefined,
        answerKey: draft.answerKey.trim() || undefined,
        errorReason: draft.reason || undefined,
      });
      setPageError(null);
      setSheet(null);
      return null;
    } catch {
      return localError("Não consegui salvar as alterações. Tente de novo.");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleting(true);
    try {
      await study.removeMistake(id);
      if (detailId === id) setDetailId(null);
      if (sheet?.mode === "edit" && sheet.id === id) setSheet(null);
      setPageError(null);
    } catch {
      setPageError(localError("Não consegui excluir este erro. Tente de novo."));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  const chatPkg =
    chatItem && chatItem.source !== "externo"
      ? (study.packageFor(chatItem.date, chatItem.kind) ?? null)
      : null;
  const chatBrief = chatItem
    ? [
        chatItem.subject ? `Matéria: ${chatItem.subject}` : "",
        chatItem.topic ? `Tópico: ${chatItem.topic}` : "",
        `Enunciado: ${chatItem.prompt}`,
        chatItem.marked ? `Eu marquei: ${chatItem.marked}` : "",
        chatItem.answerKey ? `Gabarito: ${chatItem.answerKey}` : "",
        chatItem.explanation ? `Explicação do pacote: ${chatItem.explanation}` : "",
        chatItem.errorReason ? `Motivo do erro: ${ERROR_REASON_LABEL[chatItem.errorReason]}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  if (review) {
    const progressCurrent = queue.length ? Math.min(queue.length, index + 1) : 0;
    return (
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-3">
        <section
          aria-label="Revisão de erros"
          className="rounded-2xl border border-border bg-surface p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <p role="timer" className="tabular-nums text-sm font-semibold text-primary">
                {formatClock(left)}
              </p>
              <span className="text-xs text-muted">revisão relâmpago</span>
            </div>
            <button
              type="button"
              onClick={() => setReview(false)}
              className="min-h-12 shrink-0 px-2 text-sm font-medium text-fg"
            >
              Voltar ao caderno
            </button>
          </div>

          {queue.length ? (
            <div className="mt-1">
              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                <span>Revisão espaçada</span>
                <span className="tabular-nums">{reviewProgressLabel(index, queue.length)}</span>
              </div>
              <div
                role="progressbar"
                aria-label="Progresso da revisão"
                aria-valuemin={0}
                aria-valuemax={queue.length}
                aria-valuenow={progressCurrent}
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${reviewProgressPercent(index, queue.length)}%` }}
                />
              </div>
            </div>
          ) : null}

          {!item || left === 0 ? (
            <div className="mt-4 flex flex-col items-start gap-2">
              <CheckCircle2 className="size-7 text-primary" aria-hidden />
              <h2 className="text-2xl leading-snug">
                {left === 0 ? "Os 5 minutos acabaram" : "Revisão concluída"}
              </h2>
              <p className="text-sm leading-relaxed text-muted">
                {left === 0
                  ? "O que você respondeu já foi agendado na repetição espaçada."
                  : "Você revisou todos os erros da fila. O resultado de cada um já está na repetição espaçada."}
              </p>
              <Button variant="tonal" className="mt-2" onClick={() => setReview(false)}>
                Voltar ao caderno
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {formatShortDate(item.date)} · {mistakeSourceLabel(item)} ·{" "}
                {reviewStatusLabel(item, today)}
              </p>
              <p className="mt-2 text-base leading-relaxed text-fg">{item.prompt}</p>
              {item.source === "externo" && (item.marked || item.answerKey) ? (
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {item.marked ? `Marquei: ${item.marked}` : ""}
                  {item.marked && item.answerKey ? " · " : ""}
                  {item.answerKey ? `Gabarito: ${item.answerKey}` : ""}
                </p>
              ) : null}

              {!show ? (
                <Button variant="tonal" className="mt-3 w-full" onClick={() => setShow(true)}>
                  Mostrar o gabarito
                </Button>
              ) : (
                <div className="mt-3">
                  {item.source === "externo" ? (
                    <>
                      <p className="text-sm">Marquei: {item.marked || "—"}</p>
                      <p className="mt-1 text-sm">Gabarito: {item.answerKey || "—"}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">Certa: {item.choices[item.correctIndex] ?? "—"}</p>
                      <p className="mt-1 text-sm text-muted">
                        Sua tentativa: {item.choices[item.userIndex] ?? "—"}
                      </p>
                      {item.explanation ? (
                        <p className="mt-2 text-sm leading-relaxed">{item.explanation}</p>
                      ) : null}
                    </>
                  )}
                  <p className="mt-3 text-xs text-muted">
                    Como você ficou? Isso agenda a próxima revisão.
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["errei", "dificil", "facil"] as SrsOutcome[]).map((outcome) => {
                      const interval = outcomeIntervalLabel(outcome, item.srsStage);
                      return (
                        <Button
                          key={outcome}
                          variant={
                            outcome === "errei"
                              ? "clay"
                              : outcome === "dificil"
                                ? "surface"
                                : "tonal"
                          }
                          aria-label={`${SRS_OUTCOME_LABEL[outcome]}, ${interval}`}
                          className="flex-col gap-0.5 px-2"
                          onClick={() => void answer(outcome)}
                        >
                          <span>{SRS_OUTCOME_SHORT_LABEL[outcome]}</span>
                          <span className="text-xs font-normal">{interval}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-3">
      <header className="pt-1">
        <h1 className="text-3xl leading-tight">Caderno de erros</h1>
        <p className="mt-1 text-sm text-muted">{notebookSummary(counts)}</p>
      </header>

      {pageError ? <InlineError copy={pageError} /> : null}

      {counts.due ? (
        <section className="rounded-xl border border-primary bg-surface-2 p-5">
          <h2 className="text-2xl leading-snug">
            Revisar {counts.due} {counts.due === 1 ? "erro" : "erros"} agora
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Um erro por vez. O resultado de cada um agenda a próxima revisão.
          </p>
          <Button
            className="mt-4 w-full sm:w-auto"
            onClick={() => startReview(dueList.map((m) => m.id))}
          >
            Começar revisão
          </Button>
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl leading-snug">
                {counts.total ? "Nada para revisar hoje" : "Nenhum erro guardado ainda"}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {counts.total
                  ? nextDate
                    ? nextReviewLabel(nextDate, today)
                    : "Todos os erros do caderno estão dominados."
                  : "Eles aparecem quando você erra na sessão — ou registre um erro de fora do app."}
              </p>
            </div>
          </div>
          {emptyNotebook ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Button
                variant="tonal"
                onClick={() => {
                  setPageError(null);
                  setSheet({ mode: "create" });
                }}
              >
                <Plus className="size-5" aria-hidden />
                Registrar erro
              </Button>
              <Button asChild variant="ghost" className="px-3 text-primary hover:bg-primary/10">
                <Link to="/">Estudar bloco de hoje</Link>
              </Button>
            </div>
          ) : null}
        </section>
      )}

      {!emptyNotebook ? (
        <Button
          variant="tonal"
          className="w-full sm:w-auto sm:self-start"
          onClick={() => {
            setPageError(null);
            setSheet({ mode: "create" });
          }}
        >
          <Plus className="size-5" aria-hidden />
          Registrar erro
        </Button>
      ) : null}

      {counts.total ? (
        <NotebookFilterChips
          filters={filters}
          subjects={subjects}
          reasons={reasons}
          onChange={setFilters}
          onClear={() => setFilters(clearNotebookFilters())}
        />
      ) : null}

      {list.length ? (
        <ul className="flex flex-col gap-3">
          {list.map((mistake) => (
            <li key={mistake.id}>
              <MistakeCard
                mistake={mistake}
                today={today}
                onOpen={() => setDetailId(mistake.id)}
                onEdit={() => setSheet({ mode: "edit", id: mistake.id })}
                onDelete={() => setDeleteId(mistake.id)}
              />
            </li>
          ))}
        </ul>
      ) : counts.total ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center">
          <p className="text-sm leading-relaxed text-muted">
            {emptyListMessage(filters.status, hasActiveFilters(filters))}
          </p>
          {hasActiveFilters(filters) ? (
            <button
              type="button"
              onClick={() => setFilters(clearNotebookFilters())}
              className="mt-1 min-h-12 px-3 text-sm font-semibold text-primary"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      ) : null}

      <MistakeDetailSheet
        mistake={detail}
        today={today}
        onClose={() => setDetailId(null)}
        onReview={() => {
          if (detail) startReview([detail.id]);
        }}
        onAsk={() => {
          if (!detail) return;
          setDetailId(null);
          setChatId(detail.id);
        }}
        onReason={(reason) => {
          if (detail) void study.setMistakeErrorReason(detail.id, reason);
        }}
      />

      <MistakeFormSheet
        key={sheet ? (sheet.mode === "create" ? "novo" : `editar-${sheet.id}`) : "fechado"}
        open={Boolean(sheet) && (sheet?.mode === "create" || Boolean(editing))}
        mode={sheet?.mode ?? "create"}
        initial={editing ? draftFromMistake(editing) : undefined}
        onClose={() => setSheet(null)}
        onSave={(draft) =>
          sheet?.mode === "edit" && editing ? saveEdit(editing.id, draft) : saveNew(draft)
        }
      />

      <ConfirmDialog
        open={Boolean(deleteItem)}
        title={DELETE_MISTAKE_TITLE}
        description={DELETE_MISTAKE_BODY}
        confirmLabel="Excluir"
        busy={deleting}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />

      {chatItem ? (
        <TeacherChat
          open={Boolean(chatItem)}
          onClose={() => setChatId(null)}
          blockId={
            chatItem.source === "externo"
              ? `${chatItem.date}:externo:${chatItem.id}`
              : `${chatItem.date}:${chatItem.kind}`
          }
          title={chatItem.subject ? `${chatItem.subject} · ${chatItem.topic}` : chatItem.topic}
          subtopic={chatItem.source === "externo" ? "Erro externo" : KIND_LABEL[chatItem.kind]}
          brief={chatBrief}
          holdAnswer={false}
          question={[
            chatItem.prompt,
            chatItem.marked ? `Eu marquei: ${chatItem.marked}` : "",
            chatItem.answerKey ? `Gabarito: ${chatItem.answerKey}` : "",
          ]
            .filter(Boolean)
            .join(" | ")}
          mistakes={[chatItem.prompt]}
          userKey={study.keys.xai}
          pkg={chatPkg}
          diagramSvg=""
          doubts={study.doubts}
          onSaveDoubt={(doubt) => void study.saveDoubt(doubt)}
          onSavePackage={(pkg) => void study.saveBuilt(pkg)}
          makeTest={() => null}
          quote={null}
          onQuoteUsed={() => undefined}
          questionId={chatItem.id}
        />
      ) : null}
    </div>
  );
}
