import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Drawer } from "vaul";
import { ErrorReasonPicker } from "@/components/mistake-reason";
import { TeacherChat } from "@/components/teacher-chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  easyIntervalDays,
  isDueToday,
  isMastered,
  newMistakeSrs,
  reviewStatusLabel,
  SRS_OUTCOME_LABEL,
} from "@/lib/study/srs";
import type { SrsOutcome } from "@/lib/study/srs";
import { useStudy } from "@/lib/study/store";
import { formatClock, formatShortDate, saoPauloToday } from "@/lib/study/time";
import { ERROR_REASON_LABEL, KIND_LABEL, MISTAKE_SOURCE_LABEL } from "@/lib/study/types";
import type { ErrorReason, Mistake } from "@/lib/study/types";

export const Route = createFileRoute("/_shell/erros")({
  head: () => ({ meta: [{ title: "Erros · Reta" }] }),
  component: ErrorsPage,
});

type Filter = "vencidos" | "pendentes" | "dominados";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "vencidos", label: "Para revisar hoje" },
  { id: "pendentes", label: "Todos pendentes" },
  { id: "dominados", label: "Dominados" },
];

const EMPTY_FORM = {
  subject: "",
  topic: "",
  prompt: "",
  marked: "",
  answerKey: "",
  reason: "" as ErrorReason | "",
};

function sourceLabel(mistake: Mistake): string {
  if (mistake.source === "externo")
    return `${MISTAKE_SOURCE_LABEL.externo}${mistake.subject ? ` · ${mistake.subject}` : ""}`;
  return KIND_LABEL[mistake.kind];
}

function ErrorsPage() {
  const study = useStudy();
  const today = useMemo(() => saoPauloToday(), []);

  const [filter, setFilter] = useState<Filter>("vencidos");
  const [review, setReview] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const [left, setLeft] = useState(5 * 60);
  const [chatId, setChatId] = useState<string | null>(null);
  const [externalOpen, setExternalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const due = study.mistakes.filter((m) => isDueToday(m, today));
  const pending = study.mistakes.filter((m) => !isMastered(m));
  const mastered = study.mistakes.filter((m) => isMastered(m));
  const filtered = filter === "vencidos" ? due : filter === "pendentes" ? pending : mastered;
  const list = [...filtered].sort(
    (a, b) =>
      (a.nextReviewAt ?? "").localeCompare(b.nextReviewAt ?? "") || b.createdAt - a.createdAt,
  );

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
    setReview(true);
  }

  async function answer(outcome: SrsOutcome) {
    if (!item) return;
    await study.reviewMistakeSrs(item.id, outcome, today);
    setShow(false);
    setIndex((n) => n + 1);
  }

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveExternal() {
    const prompt = form.prompt.trim();
    if (!prompt) {
      setFormError("Escreva o resumo da questão ou da dúvida.");
      return;
    }
    const subject = form.subject.trim();
    const topic = form.topic.trim();
    const mistake: Mistake = {
      id: crypto.randomUUID(),
      sessionId: "externo",
      date: today,
      kind: "A",
      topic: [subject, topic].filter(Boolean).join(" · ") || "Erro externo",
      prompt,
      choices: [],
      correctIndex: -1,
      userIndex: -1,
      explanation: "",
      createdAt: Date.now(),
      ...newMistakeSrs(today),
      source: "externo",
      subject: subject || undefined,
      marked: form.marked.trim() || undefined,
      answerKey: form.answerKey.trim() || undefined,
      errorReason: form.reason || undefined,
    };
    await study.addMistake(mistake);
    setForm(EMPTY_FORM);
    setFormError("");
    setExternalOpen(false);
    setFilter("vencidos");
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header>
        <h1 className="text-4xl">Caderno de erros</h1>
        <p className="mt-2 text-sm text-muted">
          {due.length} para revisar hoje · {pending.length} pendentes · {mastered.length} dominados.
          A revisão relâmpago dura 5 minutos e a repetição espaçada cuida do resto.
        </p>
      </header>

      {!review ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button disabled={!due.length} onClick={() => startReview(due.map((m) => m.id))}>
              Revisão relâmpago
            </Button>
            <Button variant="surface" onClick={() => setExternalOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Anotar erro externo
            </Button>
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtros do caderno">
            {FILTERS.map((tab) => {
              const count =
                tab.id === "vencidos"
                  ? due.length
                  : tab.id === "pendentes"
                    ? pending.length
                    : mastered.length;
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    "min-h-11 rounded-full border px-3 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:border-primary/50 hover:text-fg",
                  )}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>

          <ul className="flex flex-col gap-3">
            {list.map((m) => (
              <li key={m.id} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs text-muted">
                  {formatShortDate(m.date)} · {sourceLabel(m)}
                  {m.errorReason ? ` · ${ERROR_REASON_LABEL[m.errorReason]}` : ""}
                </p>
                <p className="mt-1 text-sm leading-relaxed">{m.prompt}</p>
                {m.source === "externo" && (m.marked || m.answerKey) ? (
                  <p className="mt-1 text-xs text-muted">
                    {m.marked ? `Marquei: ${m.marked}` : ""}
                    {m.marked && m.answerKey ? " · " : ""}
                    {m.answerKey ? `Gabarito: ${m.answerKey}` : ""}
                  </p>
                ) : null}
                <p
                  className={cn(
                    "mt-2 text-xs",
                    isDueToday(m, today) ? "text-primary" : "text-muted",
                  )}
                >
                  {reviewStatusLabel(m, today)}
                  {m.reviewCount ? ` · ${m.reviewCount} revisões` : ""}
                </p>
                <ErrorReasonPicker
                  className="mt-3"
                  label="Causa"
                  value={m.errorReason}
                  onChange={(reason) => void study.setMistakeErrorReason(m.id, reason)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="surface" onClick={() => startReview([m.id])}>
                    Revisar agora
                  </Button>
                  <Button variant="ghost" onClick={() => setChatId(m.id)}>
                    Perguntar ao Professor IA
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {!study.mistakes.length ? (
            <p className="text-sm text-muted">
              Nenhum erro guardado ainda. Eles aparecem quando você erra na sessão — ou aqui, pelo
              botão de anotar erro externo.
            </p>
          ) : null}
          {study.mistakes.length && !list.length ? (
            <p className="text-sm text-muted">
              {filter === "vencidos"
                ? "Nada vencido agora. Volte amanhã ou abra os pendentes."
                : filter === "pendentes"
                  ? "Nenhum erro pendente. Tudo dominado por aqui."
                  : "Nenhum erro dominado ainda. Marque “Dominado / Fácil” quando a questão ficar fácil."}
            </p>
          ) : null}
        </>
      ) : (
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="tabular-nums text-sm text-primary" role="timer">
              {formatClock(left)}
            </p>
            <Button variant="ghost" onClick={() => setReview(false)}>
              Voltar ao caderno
            </Button>
          </div>
          {!item || left === 0 ? (
            <>
              <h2 className="mt-3 text-2xl">
                {left === 0 ? "Os 5 minutos acabaram." : "Fila vazia."}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {left === 0
                  ? "O que você respondeu já foi agendado na repetição espaçada."
                  : "Nada mais nesta fila."}
              </p>
              <Button className="mt-4" variant="surface" onClick={() => setReview(false)}>
                Voltar ao caderno
              </Button>
            </>
          ) : (
            <>
              <p className="mt-3 text-xs text-muted">
                {formatShortDate(item.date)} · {sourceLabel(item)} ·{" "}
                {reviewStatusLabel(item, today)}
              </p>
              <p className="mt-2 text-lg leading-relaxed">{item.prompt}</p>
              {item.source === "externo" && (item.marked || item.answerKey) ? (
                <p className="mt-2 text-sm text-muted">
                  {item.marked ? `Marquei: ${item.marked}` : ""}
                  {item.marked && item.answerKey ? " · " : ""}
                  {item.answerKey ? `Gabarito: ${item.answerKey}` : ""}
                </p>
              ) : null}

              <ErrorReasonPicker
                className="mt-4"
                value={item.errorReason}
                onChange={(reason) => void study.setMistakeErrorReason(item.id, reason)}
              />

              {!show ? (
                <Button className="mt-4" onClick={() => setShow(true)}>
                  Mostrar o gabarito
                </Button>
              ) : (
                <div className="mt-4">
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
                  <p className="mt-4 text-xs text-muted">
                    Como você ficou? Isso agenda a próxima revisão.
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    <Button variant="clay" onClick={() => void answer("errei")}>
                      {SRS_OUTCOME_LABEL.errei}{" "}
                      <span className="text-xs font-normal">(+1 dia)</span>
                    </Button>
                    <Button variant="surface" onClick={() => void answer("dificil")}>
                      {SRS_OUTCOME_LABEL.dificil}{" "}
                      <span className="text-xs font-normal">(+3 dias)</span>
                    </Button>
                    <Button onClick={() => void answer("facil")}>
                      {SRS_OUTCOME_LABEL.facil}{" "}
                      <span className="text-xs font-normal">
                        (+{easyIntervalDays(item.srsStage ?? 0)} dias)
                      </span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <Drawer.Root open={externalOpen} onOpenChange={setExternalOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[55] bg-black/60" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[90dvh] flex-col rounded-t-2xl border border-border bg-surface">
            <Drawer.Handle className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-border" />
            <div className="flex items-start justify-between gap-3 px-4 pt-2">
              <div>
                <Drawer.Title className="font-display text-2xl">Anotar erro externo</Drawer.Title>
                <Drawer.Description className="mt-1 text-sm text-muted">
                  Simulado impresso, PDF ou dúvida fora do app. Entra no mesmo caderno e na
                  repetição espaçada.
                </Drawer.Description>
              </div>
              <Drawer.Close asChild>
                <Button variant="ghost" aria-label="Fechar">
                  Fechar
                </Button>
              </Drawer.Close>
            </div>
            <form
              className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
              onSubmit={(event) => {
                event.preventDefault();
                void saveExternal();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Matéria"
                  value={form.subject}
                  placeholder="Ex.: Biologia"
                  onChange={(v) => setField("subject", v)}
                />
                <Field
                  label="Tópico"
                  value={form.topic}
                  placeholder="Ex.: Genética"
                  onChange={(v) => setField("topic", v)}
                />
              </div>
              <Field
                label="Resumo da questão ou dúvida"
                value={form.prompt}
                placeholder="O que a questão pedia, em uma ou duas frases"
                onChange={(v) => setField("prompt", v)}
                multiline
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="O que eu marquei"
                  value={form.marked}
                  placeholder="Alternativa ou raciocínio"
                  onChange={(v) => setField("marked", v)}
                />
                <Field
                  label="Gabarito"
                  value={form.answerKey}
                  placeholder="Resposta certa"
                  onChange={(v) => setField("answerKey", v)}
                />
              </div>
              <ErrorReasonPicker
                label="Motivo do erro (opcional)"
                value={form.reason || undefined}
                onChange={(reason) => setField("reason", reason)}
              />
              {formError ? <p className="text-sm text-clay-text">{formError}</p> : null}
              <Button type="submit" className="mt-2">
                Salvar no caderno
              </Button>
            </form>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

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
          userKey={study.settings.keys.xai}
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

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  multiline?: boolean;
  onChange: (value: string) => void;
};

function Field({ label, value, placeholder, multiline, onChange }: FieldProps) {
  const className = "min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm";
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} min-h-24 py-2`}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
    </label>
  );
}
