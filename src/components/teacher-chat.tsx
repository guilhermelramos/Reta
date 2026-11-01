import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Mic, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { QuestionCard } from "@/components/study-view";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { askProfessor } from "@/lib/ai/professor-client";
import { researchAddClient } from "@/lib/ai/xai-client";
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

const SHORTCUTS = ["Explique de outro jeito", "Dê um exemplo", "Resuma em 3 linhas", "Qual é a pegadinha?"] as const;

/** Perguntas de 1 toque: evitam digitação longa no teclado do celular. */
const QUICK_QUESTIONS = [
  "Me dê uma dica sem entregar a resposta",
  "Por que a minha alternativa está errada?",
  "Qual é a pegadinha desta questão?",
  "Resuma a fórmula/conceito em 3 linhas",
] as const;

/** Detecta a largura de celular sem quebrar a hidratação do SSR. */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return mobile;
}

/**
 * No celular o professor vira gaveta inferior (vaul) arrastável. O `Dialog`
 * interno repete o estado com `modal={false}`: sem travar rolagem, sem esconder
 * o resto da tela da acessibilidade e sem prender o foco, o enunciado e o
 * cronômetro do topo seguem legíveis e clicáveis enquanto o chat está aberto.
 * No desktop fica o painel lateral de sempre.
 */
function SheetFrame({
  mobile,
  open,
  onClose,
  children,
}: {
  mobile: boolean;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!mobile) return <>{children}</>;
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      modal={false}
      noBodyStyles
      dismissible
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }} modal={false}>
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 outline-none">
            <DialogPrimitive.Title className="sr-only">Professor IA</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Converse sobre a questão aberta. O cronômetro continua contando enquanto a gaveta está aberta.
            </DialogPrimitive.Description>
            <Drawer.Handle className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-border" aria-hidden />
            {children}
          </Drawer.Content>
        </DialogPrimitive.Root>
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
}: TeacherChatProps) {
  const [draft, setDraft] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"chat" | "caderno">("chat");
  const [test, setTest] = useState<QuizItem | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [hint, setHint] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const speech = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const blockDoubts = useMemo(() => doubtsForBlock(doubts, blockId, questionId), [doubts, blockId, questionId]);
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

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError("");
    setDraft("");
    const base = ensureDoubt(content);
    const userMsg: ChatMsg = { role: "user", text: content };
    const history = [...base.messages, userMsg];
    const next: Doubt = { ...base, messages: history, updatedAt: Date.now(), title: base.title || content.slice(0, 80) };
    onSaveDoubt(next);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Sem internet. Dá para seguir a sessão; o professor volta quando a rede voltar.");
      return;
    }
    setBusy(true);
    try {
      await askProfessor(
        {
          messages: history.map((item) => ({ role: item.role === "professor" ? "assistant" : "user", content: item.text })),
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
            ...next,
            updatedAt: Date.now(),
            messages: [...history, { role: "professor", text: view.text || "…", outside: view.outside, cite: view.cite, svg: view.svg || undefined }],
          };
          onSaveDoubt(streaming);
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao falar com o professor.");
    } finally {
      setBusy(false);
    }
  }

  function draw() {
    const svg = diagramSvg && validateDiagram(diagramSvg).ok ? sanitizeSvg(diagramSvg) : "";
    const base = ensureDoubt("Desenhe isso");
    const msg: ChatMsg = svg
      ? { role: "professor", text: "Desenho do subtópico, no gabarito. «Visuais › Diagrama»", svg, cite: "Visuais › Diagrama" }
      : { role: "professor", text: "Este subtópico ainda não tem um diagrama válido." };
    onSaveDoubt({ ...base, updatedAt: Date.now(), messages: [...base.messages, { role: "user", text: "Desenhe isso em SVG" }, msg] });
  }

  function testMe() {
    const item = makeTest();
    if (!item) {
      setError("As questões deste subtópico já foram usadas.");
      return;
    }
    setTest(item);
    setPicked(null);
    setConfirmed(false);
    setHint(false);
    setError("");
  }

  async function research() {
    if (!pkg || busy) return;
    const last = [...(active?.messages ?? [])].reverse().find((item) => item.role === "user");
    if (!last) return;
    setBusy(true);
    setError("");
    try {
      const res = await researchAddClient({ question: last.text, topic: title, userKey });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSavePackage(mergeAddition(pkg, pkg.subtopics?.find((item) => item.title === subtopic)?.id || pkg.subtopics?.[0]?.id || "", res.data));
      if (active) {
        onSaveDoubt({
          ...active,
          updatedAt: Date.now(),
          messages: [...active.messages, { role: "professor", text: "Pesquisei e acrescentei ao pacote, com as fontes que vieram.", cite: "Essência › Acrescentado agora" }],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na pesquisa.");
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    const w = window as Window & { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.onresult = (event) => {
      const said = event.results?.[0]?.[0]?.transcript ?? "";
      if (said) setDraft((prev) => `${prev} ${said}`.trim());
    };
    rec.onerror = () => setError("Não ouvi. Digite a dúvida.");
    rec.start();
  }

  function mark(status: Doubt["status"]) {
    if (!active) return;
    onSaveDoubt({ ...active, status, updatedAt: Date.now() });
  }

  return (
    <SheetFrame mobile={isMobile} open={open} onClose={onClose}>
    <section
      className={cn(
        "flex flex-col overflow-hidden border border-border bg-surface",
        isMobile
          ? "h-[72dvh] max-h-[85dvh] rounded-t-2xl"
          : "fixed inset-x-0 bottom-0 z-50 h-[50dvh] rounded-t-2xl md:left-auto md:right-4 md:w-[28rem]",
      )}
      aria-label="Professor"
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm">Professor · o tempo segue contando</p>
        <button type="button" className="min-h-11 px-2 text-xs text-muted" onClick={() => setTab(tab === "chat" ? "caderno" : "chat")}>
          {tab === "chat" ? "Caderno" : "Conversa"}
        </button>
        <button type="button" className="grid size-11 place-items-center" aria-label="Fechar professor" onClick={onClose}>
          <X className="size-4" />
        </button>
      </header>
      {tab === "caderno" ? (
        <ul className="flex-1 space-y-2 overflow-y-auto p-3">
          {blockDoubts.length ? null : <li className="text-sm text-muted">Nenhuma dúvida neste bloco ainda.</li>}
          {blockDoubts.map((doubt) => (
            <li key={doubt.id}>
              <button
                type="button"
                className="w-full rounded-xl border border-border px-3 py-2 text-left"
                onClick={() => {
                  setActiveId(doubt.id);
                  setTab("chat");
                }}
              >
                <span className="block text-sm">{doubt.title}</span>
                <span className="text-xs text-muted">{doubt.status === "resolvida" ? "Resolvida" : doubt.status === "revisar" ? "Revisar depois" : "Aberta"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {(active?.messages ?? []).map((msg, index) => (
              <div key={`${msg.role}-${index}`} className={msg.role === "user" ? "ml-8 rounded-xl bg-surface-2 px-3 py-2 text-sm" : "mr-6 text-sm leading-relaxed"}>
                {msg.outside ? <p className="mb-1 text-xs text-clay-text">Isso não está no pacote deste bloco.</p> : null}
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.cite ? <p className="mt-1 text-xs text-primary">{msg.cite}</p> : null}
                {msg.svg ? <div className="study-diagram mt-2" dangerouslySetInnerHTML={{ __html: msg.svg }} /> : null}
              </div>
            ))}
            {!active?.messages.length && !test ? (
              <div className="rounded-xl border border-dashed border-border p-3 text-sm leading-relaxed text-muted">
                <p>Pergunte sem sair da questão: toque numa pergunta rápida abaixo ou escreva do seu jeito.</p>
                <p className="mt-1 text-xs">O cronômetro continua contando com a gaveta aberta.</p>
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
                  <Button className="mt-3" disabled={picked == null} onClick={() => setConfirmed(true)}>
                    Confirmar
                  </Button>
                ) : null}
              </div>
            ) : null}
            {error ? <p className="text-sm text-clay-text">{error}</p> : null}
            {active?.messages.some((msg) => msg.outside) ? (
              <Button variant="surface" disabled={busy} onClick={() => void research()}>
                Pesquisar e adicionar ao pacote
              </Button>
            ) : null}
          </div>
          <div className="border-t border-border p-2 pb-[calc(env(safe-area-inset-bottom)_+_0.5rem)] md:pb-2">
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1" aria-label="Perguntas rápidas">
              {QUICK_QUESTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled={busy}
                  className="min-h-11 shrink-0 rounded-full border border-primary/60 bg-primary/10 px-3 text-xs font-semibold text-primary disabled:opacity-50"
                  onClick={() => void send(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {SHORTCUTS.map((label) => (
                <button key={label} type="button" className="min-h-11 shrink-0 rounded-full border border-border px-3 text-xs" onClick={() => void send(label)}>
                  {label}
                </button>
              ))}
              <button type="button" className="min-h-11 shrink-0 rounded-full border border-border px-3 text-xs" onClick={draw}>
                Desenhe isso em SVG
              </button>
              <button type="button" className="min-h-11 shrink-0 rounded-full border border-border px-3 text-xs" onClick={testMe}>
                Me teste nisso
              </button>
            </div>
            {active ? (
              <div className="mb-2 flex gap-2">
                <Button variant="surface" onClick={() => mark("resolvida")}>Resolvida</Button>
                <Button variant="ghost" onClick={() => mark("revisar")}>Revisar depois</Button>
              </div>
            ) : null}
            {!speech ? <p className="px-1 pb-1 text-xs text-muted">Sem microfone neste navegador: digite a dúvida.</p> : null}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft);
              }}
            >
              {speech ? (
                <button type="button" className="grid size-11 shrink-0 place-items-center rounded-xl border border-border" aria-label="Falar a dúvida" onClick={listen}>
                  <Mic className="size-4" />
                </button>
              ) : null}
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Pergunte sobre este trecho"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 text-sm"
              />
              <Button type="submit" disabled={busy || !draft.trim()}>
                {busy ? "…" : "Enviar"}
              </Button>
            </form>
          </div>
        </>
      )}
    </section>
    </SheetFrame>
  );
}
