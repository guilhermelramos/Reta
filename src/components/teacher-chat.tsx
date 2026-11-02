import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUp, BookOpen, Clock, Mic, X } from "lucide-react";
import { Drawer } from "vaul";
import { useBackOverlay } from "@/lib/android/use-back-overlay";
import { QuestionCard } from "@/components/study-view";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/feedback/button-spinner";
import { InlineError } from "@/components/feedback/inline-error";
import { askProfessor } from "@/lib/ai/professor-client";
import { researchAddClient } from "@/lib/ai/xai-client";
import { canSendMessage } from "@/lib/study/chat-ui";
import { notebookChipLabel, professorChips } from "@/lib/study/professor-chips";
import { describeError, type ErrorCopy } from "@/lib/feedback/error-copy";
import { validateDiagram } from "@/lib/study/diagrams";
import { mergeAddition } from "@/lib/study/outline";
import { sanitizeSvg } from "@/lib/study/svg";
import type { ChatMsg, Doubt, QuizItem, StudyPackage } from "@/lib/study/types";

type SpeechCtor = new () => {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** Erro local (sem rede envolvida): sem ação de retry enganosa. */
function notice(message: string): ErrorCopy {
  return { ...describeError(message), action: undefined };
}

function visibleAnswer(raw: string): string {
  const cut = raw.search(/<svg\b/i);
  return (cut >= 0 ? raw.slice(0, cut) : raw).trim();
}

function present(raw: string): { text: string; outside: boolean; cite: string; svg: string } {
  const lines = raw.replace(/^\uFEFF/, "").split("\n");
  const first = lines[0]?.trim() ?? "";
  const outside = first === "FORA";
  const status = first === "FORA" || first === "DENTRO";
  const waiting = !raw.includes("\n") && ("DENTRO".startsWith(first) || "FORA".startsWith(first));
  const body = status ? lines.slice(1).join("\n").trim() : waiting ? "" : raw.trim();
  const text = visibleAnswer(body);
  const svgMatch = raw.match(/<svg\b[\s\S]*<\/svg>/i);
  const clean = svgMatch ? sanitizeSvg(svgMatch[0]) : "";
  const svg = clean && validateDiagram(clean).ok ? clean : "";
  return { text: text || "…", outside, cite: text.match(/«([^»]+)»/)?.[1] ?? "", svg };
}

/** Folha inferior modal (vaul): 90% da altura, alça de arraste e volta do Android. */
function SheetFrame({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      noBodyStyles
      dismissible
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[90dvh] max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-border bg-surface outline-none">
          <Drawer.Title className="sr-only">Professor</Drawer.Title>
          <Drawer.Description className="sr-only">
            Converse sobre a questão aberta. O cronômetro continua contando enquanto a folha está
            aberta.
          </Drawer.Description>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export type TeacherChatProps = {
  open: boolean;
  onClose: () => void;
  blockId: string;
  title: string;
  subtopic: string;
  brief: string;
  holdAnswer: boolean;
  question: string;
  mistakes: string[];
  userKey: string;
  pkg: StudyPackage | null;
  diagramSvg: string;
  doubts: Doubt[];
  onSaveDoubt: (doubt: Doubt) => void;
  onSavePackage: (pkg: StudyPackage) => void;
  makeTest: () => QuizItem | null;
  quote: string | null;
  onQuoteUsed: () => void;
  /**
   * Questão aberta (ou erro do Caderno de Erros) desta conversa. Opcional:
   * dúvidas antigas, sem o campo, continuam aparecendo no escopo do bloco.
   */
  questionId?: string;
  /**
   * Número do timer já formatado pela lógica pura da sessão (`headline`):
   * "23:14" enquanto conta, "+02:10" depois da meta. É o mesmo texto do
   * cabeçalho, então os dois nunca divergem.
   */
  timerClock?: string;
  /** O bloco já passou da meta (só muda o rótulo acessível do chip). */
  timerExpired?: boolean;
};

/** Dúvidas salvas que pertencem a um bloco — e, quando informado, à questão aberta. */
export function doubtsForBlock(doubts: Doubt[], blockId: string, questionId?: string): Doubt[] {
  const scoped = doubts.filter((item) => item.blockId === blockId);
  if (!questionId) return scoped;
  return scoped.filter((item) => !item.questionId || item.questionId === questionId);
}

export function TeacherChat({
  open,
  onClose,
  blockId,
  title,
  subtopic,
  brief,
  holdAnswer,
  question,
  mistakes,
  userKey,
  pkg,
  diagramSvg,
  doubts,
  onSaveDoubt,
  onSavePackage,
  makeTest,
  quote,
  onQuoteUsed,
  questionId,
  timerClock,
  timerExpired,
}: TeacherChatProps) {
  const [draft, setDraft] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<"chat" | "research" | null>(null);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const retry = useRef<(() => void) | null>(null);
  const [tab, setTab] = useState<"chat" | "caderno">("chat");
  const [test, setTest] = useState<QuizItem | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [hint, setHint] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const speech =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // A gaveta do professor é um overlay: o voltar do Android fecha só ela,
  // sem sair da sessão nem perder o cronômetro.
  useBackOverlay(open, onClose);

  const blockDoubts = useMemo(
    () => doubtsForBlock(doubts, blockId, questionId),
    [doubts, blockId, questionId],
  );
  const active = blockDoubts.find((item) => item.id === activeId) ?? null;

  // Ao reabrir o bloco (ou a questão vinda do Caderno de Erros), a conversa
  // salva aparece na hora — sem nenhuma chamada nova à IA.
  useEffect(() => {
    setActiveId(null);
  }, [blockId, questionId]);

  useEffect(() => {
    if (!open || activeId) return;
    const latest = [...blockDoubts].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (latest) setActiveId(latest.id);
  }, [open, activeId, blockDoubts]);

  useEffect(() => {
    if (!open || !quote) return;
    setDraft(`Sobre este trecho: “${quote}”\n`);
    setTab("chat");
    onQuoteUsed();
  }, [open, quote, onQuoteUsed]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [active?.messages.length, busy, open]);

  if (!open) return null;

  function showError(copy: ErrorCopy, onRetry?: () => void) {
    setError(copy);
    retry.current = onRetry ?? null;
  }

  function clearError() {
    setError(null);
    retry.current = null;
  }

  function ensureDoubt(first: string): Doubt {
    if (active) return active;
    const created: Doubt = {
      id: crypto.randomUUID(),
      blockId,
      questionId,
      title: first.slice(0, 80),
      status: "aberta",
      updatedAt: Date.now(),
      messages: [],
    };
    setActiveId(created.id);
    return created;
  }

  /** Pergunta a partir da conversa já salva — o retry não duplica a mensagem. */
  async function answer(doubt: Doubt) {
    if (busy) return;
    const history = doubt.messages;
    if (!online()) {
      showError(describeError(null, { online: false }), () => void answer(doubt));
      return;
    }
    setBusy(true);
    setBusyKind("chat");
    try {
      await askProfessor(
        {
          messages: history.map((item) => ({
            role: item.role === "professor" ? "assistant" : "user",
            content: item.text,
          })),
          brief,
          topic: title,
          subtopic,
          holdAnswer,
          question,
          mistakes,
          userKey,
        },
        (raw) => {
          const view = present(raw);
          const streaming: Doubt = {
            ...doubt,
            updatedAt: Date.now(),
            messages: [
              ...history,
              {
                role: "professor",
                text: view.text || "…",
                outside: view.outside,
                cite: view.cite,
                svg: view.svg || undefined,
              },
            ],
          };
          onSaveDoubt(streaming);
        },
      );
      clearError();
    } catch (err) {
      showError(describeError(err, { online: online() }), () => void answer(doubt));
    } finally {
      setBusy(false);
      setBusyKind(null);
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    clearError();
    setDraft("");
    const base = ensureDoubt(content);
    const userMsg: ChatMsg = { role: "user", text: content };
    const next: Doubt = {
      ...base,
      messages: [...base.messages, userMsg],
      updatedAt: Date.now(),
      title: base.title || content.slice(0, 80),
    };
    onSaveDoubt(next);
    await answer(next);
  }

  function draw() {
    const svg = diagramSvg && validateDiagram(diagramSvg).ok ? sanitizeSvg(diagramSvg) : "";
    const base = ensureDoubt("Desenhe isso");
    const msg: ChatMsg = svg
      ? {
          role: "professor",
          text: "Desenho do subtópico, no gabarito. «Visuais › Diagrama»",
          svg,
          cite: "Visuais › Diagrama",
        }
      : { role: "professor", text: "Este subtópico ainda não tem um diagrama válido." };
    onSaveDoubt({
      ...base,
      updatedAt: Date.now(),
      messages: [...base.messages, { role: "user", text: "Desenhe isso em SVG" }, msg],
    });
  }

  function testMe() {
    const item = makeTest();
    if (!item) {
      showError(notice("As questões deste subtópico já foram usadas."));
      return;
    }
    setTest(item);
    setPicked(null);
    setConfirmed(false);
    setHint(false);
    clearError();
  }

  async function research() {
    if (!pkg || busy) return;
    const last = [...(active?.messages ?? [])].reverse().find((item) => item.role === "user");
    if (!last) return;
    clearError();
    if (!online()) {
      showError(describeError(null, { online: false }), () => void research());
      return;
    }
    setBusy(true);
    setBusyKind("research");
    try {
      const res = await researchAddClient({ question: last.text, topic: title, userKey });
      if (!res.ok) {
        showError(
          describeError(res.failure ?? res.error, { online: online() }),
          () => void research(),
        );
        return;
      }
      onSavePackage(
        mergeAddition(
          pkg,
          pkg.subtopics?.find((item) => item.title === subtopic)?.id ||
            pkg.subtopics?.[0]?.id ||
            "",
          res.data,
        ),
      );
      if (active) {
        onSaveDoubt({
          ...active,
          updatedAt: Date.now(),
          messages: [
            ...active.messages,
            {
              role: "professor",
              text: "Pesquisei e acrescentei ao pacote, com as fontes que vieram.",
              cite: "Essência › Acrescentado agora",
            },
          ],
        });
      }
    } catch (err) {
      showError(describeError(err, { online: online() }), () => void research());
    } finally {
      setBusy(false);
      setBusyKind(null);
    }
  }

  function listen() {
    const w = window as Window & {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.onresult = (event) => {
      const said = event.results?.[0]?.[0]?.transcript ?? "";
      if (said) setDraft((prev) => `${prev} ${said}`.trim());
    };
    rec.onerror = () => showError(notice("Não ouvi. Digite a dúvida."));
    rec.start();
  }

  function mark(status: Doubt["status"]) {
    if (!active) return;
    onSaveDoubt({ ...active, status, updatedAt: Date.now() });
  }

  return (
    <SheetFrame open={open} onClose={onClose}>
      <Drawer.Handle
        className="mx-auto my-2 shrink-0 rounded-full bg-border"
        style={{ width: 32, height: 4 }}
        aria-hidden
      />
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="Professor">
        <header className="flex flex-col gap-1 border-b border-border px-4 pb-3 pt-2">
          <div className="flex items-center gap-2">
            {timerClock ? (
              <span
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-primary bg-primary-tonal px-2.5 font-mono text-[13px] tabular-nums text-primary"
                aria-label={
                  timerExpired ? `Tempo estourado: ${timerClock}` : `Tempo restante: ${timerClock}`
                }
              >
                <Clock className="hidden size-4 min-[400px]:block" aria-hidden />
                {timerClock}
              </span>
            ) : null}
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold max-[359px]:sr-only">
              Professor IA
            </h2>
            <button
              type="button"
              className="ml-auto grid h-12 shrink-0 place-items-center"
              aria-pressed={tab === "caderno"}
              onClick={() => setTab(tab === "chat" ? "caderno" : "chat")}
            >
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs text-muted">
                <BookOpen className="size-4" aria-hidden />
                {notebookChipLabel(tab)}
              </span>
            </button>
            <button
              type="button"
              className="grid size-12 shrink-0 place-items-center rounded-full"
              aria-label="Fechar professor"
              onClick={onClose}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <p className="truncate text-xs text-muted">
            {title}
            {subtopic ? ` · ${subtopic}` : ""}
          </p>
        </header>
        {tab === "caderno" ? (
          <ul className="flex-1 space-y-2 overflow-y-auto p-3">
            {blockDoubts.length ? null : (
              <li className="text-sm text-muted">Nenhuma dúvida neste bloco ainda.</li>
            )}
            {blockDoubts.map((doubt) => (
              <li key={doubt.id}>
                <button
                  type="button"
                  className="flex min-h-12 w-full flex-col justify-center rounded-xl border border-border px-3 py-2 text-left"
                  onClick={() => {
                    setActiveId(doubt.id);
                    setTab("chat");
                  }}
                >
                  <span className="block text-sm">{doubt.title}</span>
                  <span className="text-xs text-muted">
                    {doubt.status === "resolvida"
                      ? "Resolvida"
                      : doubt.status === "revisar"
                        ? "Revisar depois"
                        : "Aberta"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {(active?.messages ?? []).map((msg, index) => (
                <div
                  key={`${msg.role}-${index}`}
                  className={
                    msg.role === "user"
                      ? "ml-8 rounded-xl bg-surface-2 px-3 py-2 text-base leading-relaxed"
                      : "mr-6 text-base leading-relaxed"
                  }
                >
                  {msg.outside ? (
                    <p className="mb-1 text-xs text-clay-text">
                      Isso não está no pacote deste bloco.
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.cite ? <p className="mt-1 text-xs text-primary">{msg.cite}</p> : null}
                  {msg.svg ? (
                    <div
                      className="study-diagram mt-2"
                      dangerouslySetInnerHTML={{ __html: msg.svg }}
                    />
                  ) : null}
                </div>
              ))}
              {!active?.messages.length && !test ? (
                <div className="rounded-xl border border-dashed border-border p-3 text-base leading-relaxed text-muted">
                  <p>
                    Pergunte sem sair da questão: toque numa pergunta rápida abaixo ou escreva do
                    seu jeito.
                  </p>
                  <p className="mt-1 text-xs">
                    O cronômetro continua contando com a gaveta aberta.
                  </p>
                </div>
              ) : null}
              {test ? (
                <div className="rounded-xl border border-border p-3">
                  <QuestionCard
                    item={test}
                    selected={picked}
                    confirmed={confirmed}
                    showHint={hint}
                    altText=""
                    onSelect={setPicked}
                    onHint={() => setHint(true)}
                    onOther={() => undefined}
                    otherBusy={false}
                  />
                  {!confirmed ? (
                    <Button
                      className="mt-3"
                      disabled={picked == null}
                      onClick={() => setConfirmed(true)}
                    >
                      Confirmar
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {error ? <InlineError copy={error} onAction={() => retry.current?.()} /> : null}
              {active?.messages.some((msg) => msg.outside) ? (
                <Button variant="surface" disabled={busy} onClick={() => void research()}>
                  {busy && busyKind === "research" ? (
                    <>
                      <ButtonSpinner />
                      Pesquisando…
                    </>
                  ) : (
                    "Pesquisar e adicionar ao pacote"
                  )}
                </Button>
              ) : null}
            </div>
            <div className="border-t border-border pb-[calc(env(safe-area-inset-bottom)_+_0.75rem)] pt-2">
              <div className="session-chips" role="group" aria-label="Atalhos do professor">
                {professorChips(active?.messages.length ?? 0).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    disabled={busy && chip.kind === "ask"}
                    className="session-chip"
                    onClick={() => {
                      if (chip.kind === "ask") void send(chip.label);
                      else if (chip.kind === "draw") draw();
                      else testMe();
                    }}
                  >
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
              <div className="px-4">
                {active ? (
                  <div className="mb-2 flex gap-2">
                    <Button variant="surface" onClick={() => mark("resolvida")}>
                      Resolvida
                    </Button>
                    <Button variant="ghost" onClick={() => mark("revisar")}>
                      Revisar depois
                    </Button>
                  </div>
                ) : null}
                {!speech ? (
                  <p className="px-1 pb-1 text-xs text-muted">
                    Sem microfone neste navegador: digite a dúvida.
                  </p>
                ) : null}
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send(draft);
                  }}
                >
                  {speech ? (
                    <button
                      type="button"
                      className="grid size-12 shrink-0 place-items-center rounded-xl border border-border"
                      aria-label="Falar a dúvida"
                      onClick={listen}
                    >
                      <Mic className="size-4" aria-hidden />
                    </button>
                  ) : null}
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Pergunte sobre este trecho"
                    aria-label="Mensagem para o professor"
                    className="min-h-12 min-w-0 flex-1 rounded-[24px] border border-border bg-bg px-4 text-base"
                  />
                  <button
                    type="submit"
                    aria-label="Enviar"
                    disabled={!canSendMessage(draft, busy)}
                    className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-fg disabled:bg-surface-2 disabled:text-muted"
                  >
                    {busy && busyKind === "chat" ? (
                      <ButtonSpinner />
                    ) : (
                      <ArrowUp className="size-5" aria-hidden />
                    )}
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </section>
    </SheetFrame>
  );
}
