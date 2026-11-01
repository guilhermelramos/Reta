import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FlashcardDeck, GeneratePackage } from "@/components/generate-package";
import { LessonView } from "@/components/lesson-view";
import { ErrorReasonPicker } from "@/components/mistake-reason";
import { QuestionCard } from "@/components/study-view";
import { TeacherChat } from "@/components/teacher-chat";
import { Button } from "@/components/ui/button";
import { isRichPackage } from "@/lib/ai/package.functions";
import { coverageProblems, isModernaBlock } from "@/lib/study/coverage";
import {
  clearActiveSession,
  loadActiveSession,
  saveActiveSession,
  type ActiveSessionRecord,
} from "@/lib/study/db";
import { bumpLevel, emptyFlow, pickPractice, questionFor } from "@/lib/study/flow";
import { buildHumanasPackage } from "@/lib/study/humanas-pack";
import { notifyBlockDone } from "@/lib/study/notify";
import { blockHeading } from "@/lib/study/outline";
import { newMistakeSrs } from "@/lib/study/srs";
import { useStudy } from "@/lib/study/store";
import {
  formatClock,
  formatMin,
  saoPauloToday,
  timerElapsedMs,
  timerExpired,
  timerFromSession,
  timerPause,
  timerRemainingMs,
  timerStart,
  timerToSession,
} from "@/lib/study/time";
import type { BlockKind, ErrorReason, QuizItem, SessionMode, StudyPackage, StudySession, Subtopic } from "@/lib/study/types";

export const Route = createFileRoute("/_shell/sessao")({
  validateSearch: (search: Record<string, unknown>) => ({
    dia: typeof search.dia === "string" ? search.dia : "",
    bloco: (search.bloco === "B" || search.bloco === "R" || search.bloco === "L" ? search.bloco : "A") as BlockKind,
    modo: (search.modo === "15" ? "15" : "cheio") as SessionMode,
    auto: search.auto === 1 || search.auto === "1" ? 1 : 0,
  }),
  head: () => ({ meta: [{ title: "Sessão · Reta" }] }),
  component: SessionPage,
});

const pendingSessions = new Map<string, string>();
const SECTIONS = [
  ["essencia", "Essência"],
  ["conceitos", "Conceitos"],
  ["visuais", "Visuais"],
  ["pegadinhas", "Pegadinhas"],
] as const;

function liveSeconds(session: StudySession, now: number): number {
  return timerElapsedMs(timerFromSession(session), now) / 1000;
}

function freeze(session: StudySession, now: number): StudySession {
  return { ...session, ...timerToSession(timerPause(timerFromSession(session), now), now) };
}

function blockKeyOf(session: Pick<StudySession, "date" | "kind" | "mode">): string {
  return `${session.date}:${session.kind}:${session.mode}`;
}

function activeRecordOf(session: StudySession, timer = timerFromSession(session)): ActiveSessionRecord {
  return {
    blockKey: blockKeyOf(session),
    sessionId: session.id,
    date: session.date,
    kind: session.kind,
    mode: session.mode,
    running: timer.startedAt != null,
    startedAt: timer.startedAt,
    accumulatedElapsedMs: Math.max(0, timer.accumulatedElapsedMs),
    budgetMin: session.budgetMin,
    updatedAt: Date.now(),
  };
}

/** Salva o cronômetro da sessão ativa; some do banco quando o bloco fecha. */
function persistActive(session: StudySession): void {
  if (session.status !== "active") {
    void clearActiveSession().catch(() => undefined);
    return;
  }
  void saveActiveSession(activeRecordOf(session)).catch(() => undefined);
}

type WakeLockLike = {
  released: boolean;
  release: () => Promise<void>;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
};

/**
 * Mantém a tela acesa enquanto o bloco corre e reativa o lock quando a aba
 * volta ao primeiro plano. Sem suporte (ou sem permissão), segue em silêncio.
 */
function useScreenWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockLike | null>(null);

  useEffect(() => {
    if (!active) return;
    let live = true;

    async function acquire() {
      if (typeof navigator === "undefined") return;
      const api = (navigator as WakeLockNavigator).wakeLock;
      if (!api?.request) return;
      if (lockRef.current && !lockRef.current.released) return;
      try {
        const lock = await api.request("screen");
        if (!live) {
          void lock.release().catch(() => undefined);
          return;
        }
        lockRef.current = lock;
      } catch {
        /* navegador sem Wake Lock ou fora de foco: fallback silencioso */
      }
    }

    async function release() {
      const lock = lockRef.current;
      lockRef.current = null;
      if (!lock) return;
      try {
        await lock.release();
      } catch {
        /* já liberado pelo sistema */
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") void acquire();
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
      void release();
    };
  }, [active]);
}

function withFlow(session: StudySession): StudySession {
  return session.flow ? session : { ...session, flow: emptyFlow() };
}

function briefOf(pkg: StudyPackage, sub?: Subtopic): string {
  const lines = [
    pkg.essence.join("\n"),
    ...(sub?.beats.flatMap((beat) => [`## ${beat.heading}`, ...beat.paragraphs, beat.whyExam]) ?? []),
    ...(sub?.concepts.map((concept) => `Conceito ${concept.term}: ${concept.meaning}`) ?? pkg.concepts.map((concept) => `${concept.term}: ${concept.meaning}`)),
    ...(sub?.pitfalls.map((pit) => `Pegadinha ${pit.mistake}`) ?? []),
  ];
  return lines.join("\n").slice(0, 6000);
}

function SessionPage() {
  const search = Route.useSearch();
  const study = useStudy();
  const day = study.days.find((item) => item.date === search.dia);
  const block = day?.blocks.find((item) => item.kind === search.bloco);
  const pkg = study.packageFor(search.dia, search.bloco);
  const [sid, setSid] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [trap, setTrap] = useState<QuizItem | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const [chat, setChat] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [barOpen, setBarOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const [wrongMistakeId, setWrongMistakeId] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<ErrorReason | null>(null);
  const tried = useRef(false);
  const restoredRef = useRef(false);
  const alertedRef = useRef("");
  const sessionRef = useRef<StudySession | null>(null);

  const session = study.sessions.find((item) => item.id === sid) ?? null;
  const flow = session?.flow ?? emptyFlow();
  const subs = pkg?.subtopics ?? [];
  const sub = subs[flow.sub] ?? subs[0];
  const heading = blockHeading(block?.content ?? pkg?.topic ?? "");
  sessionRef.current = session;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Voltou da aba/app: recalcula o tempo real na hora, sem esperar o intervalo.
  useEffect(() => {
    function resync() {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
    }
    function onHidden() {
      if (document.visibilityState === "visible") return;
      const live = sessionRef.current;
      if (!live || live.status !== "active") return;
      persistActive(live);
    }
    window.addEventListener("focus", resync);
    window.addEventListener("pageshow", resync);
    document.addEventListener("visibilitychange", resync);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("focus", resync);
      window.removeEventListener("pageshow", resync);
      document.removeEventListener("visibilitychange", resync);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  // Sessão ativa recuperada do IndexedDB (reload, app morto pelo celular, revive).
  useEffect(() => {
    if (!study.ready || restoredRef.current) return;
    restoredRef.current = true;
    let live = true;
    const key = `${search.dia}:${search.bloco}:${search.modo}`;
    // Se o banco local demorar (aparelho engasgado), não trava a sessão.
    const fallback = window.setTimeout(() => setRestored(true), 1500);
    loadActiveSession()
      .then((record) => {
        if (!live || !record || record.blockKey !== key) return;
        const stored = study.sessions.find((item) => item.id === record.sessionId);
        if (!stored || stored.status !== "active") return;
        pendingSessions.set(key, stored.id);
        const storedMs = timerElapsedMs(timerFromSession(stored), Date.now());
        if (record.accumulatedElapsedMs > storedMs + 1000) {
          void study.upsertSession({
            ...stored,
            ...timerToSession(
              {
                accumulatedElapsedMs: record.accumulatedElapsedMs,
                startedAt: record.running ? record.startedAt : null,
              },
              Date.now(),
            ),
          });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(fallback);
        setRestored(true);
      });
    return () => {
      live = false;
      window.clearTimeout(fallback);
    };
  }, [study, study.ready, study.sessions, study.upsertSession, search.dia, search.bloco, search.modo]);

  // Fim do tempo do bloco / Revisão Relâmpago: vibra uma vez e notifica.
  useEffect(() => {
    if (!session || session.status !== "active" || !session.running) return;
    const elapsedMs = timerElapsedMs(timerFromSession(session), now);
    if (!timerExpired(session.budgetMin, elapsedMs)) return;
    const key = `${session.id}:${session.budgetMin}`;
    if (alertedRef.current === key) return;
    alertedRef.current = key;
    void notifyBlockDone({
      kind: session.kind,
      topic: pkg?.displayTitle || heading.title,
      minutes: session.budgetMin,
      mode: session.mode,
    });
  }, [session, now, pkg, heading.title]);

  useScreenWakeLock(Boolean(session && session.status === "active" && session.running));

  useEffect(() => {
    if (!block || !isModernaBlock(block.content)) return;
    if (!pkg) {
      if (tried.current) return;
      tried.current = true;
      void study.buildOne(search.dia, search.bloco).then((error) => {
        if (error) setBuildError(error);
      });
      return;
    }
    if (pkg.schemaVersion === 2 && coverageProblems(pkg, block.content).length === 0) return;
    void study.saveBuilt(buildHumanasPackage({ id: `${search.dia}:${search.bloco}`, date: search.dia, kind: search.bloco, topic: block.content }));
  }, [block, pkg, search.dia, search.bloco, study]);

  useEffect(() => {
    if (!restored || sid || !block || block.plannedMin <= 0) return;
    const key = `${search.dia}:${search.bloco}:${search.modo}`;
    const active = study.sessions.find((item) => item.date === search.dia && item.kind === search.bloco && item.mode === search.modo && item.status === "active");
    if (active) {
      setSid(active.id);
      return;
    }
    const pendingId = pendingSessions.get(key);
    if (pendingId) {
      setSid(pendingId);
      return;
    }
    const created = withFlow({
      id: crypto.randomUUID(),
      date: search.dia,
      kind: search.bloco,
      mode: search.modo,
      sheetMin: block.plannedMin,
      budgetMin: search.modo === "15" ? 15 : block.plannedMin,
      bonusMin: 0,
      elapsedSec: 0,
      running: false,
      runStartedAt: null,
      status: "active",
      step: "diag",
      diagCorrect: null,
      asked: [],
      correct: 0,
      wrong: 0,
      difficulty: "facil",
      missed: [],
      startedAt: Date.now(),
      endedAt: null,
      flow: emptyFlow(),
    });
    pendingSessions.set(key, created.id);
    setSid(created.id);
    void study.upsertSession(created);
    persistActive(created);
  }, [restored, sid, block, search.dia, search.bloco, search.modo, study]);

  const liveQuestion = sub && session ? questionFor(sub, flow) : null;
  const current = trap
    ? trap
    : flow.phase === "pratica"
      ? (sub?.practice.find((item) => item.id === shownId) ?? liveQuestion)
      : flow.phase === "diag" || flow.phase === "checagem"
        ? liveQuestion
        : null;

  useEffect(() => {
    if (!sub || flow.phase !== "pratica") return;
    if (shownId && sub.practice.some((item) => item.id === shownId)) return;
    const next = pickPractice(sub, flow);
    if (next) setShownId(next.id);
  }, [flow, shownId, sub]);

  useEffect(() => {
    setSelected(null);
    setConfirmed(false);
    setShowHint(false);
    setWrongMistakeId(null);
    setErrorReason(null);
  }, [current?.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!current || confirmed) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key >= "1" && Number(event.key) <= current.choices.length) setSelected(Number(event.key) - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, confirmed]);

  if (!day || !block) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl">Bloco não encontrado</h1>
        <Button className="mt-4" asChild>
          <Link to="/">Voltar para hoje</Link>
        </Button>
      </div>
    );
  }

  async function save(next: StudySession) {
    const merged = withFlow(next);
    await study.upsertSession(merged);
    persistActive(merged);
  }

  function toggleTimer() {
    if (!session) return;
    const nowMs = Date.now();
    if (session.running) {
      const paused = freeze(session, nowMs);
      setNow(nowMs);
      void save(paused);
      return;
    }
    const resumed = { ...session, ...timerToSession(timerStart(timerFromSession(session), nowMs), nowMs) };
    setNow(nowMs);
    void save(resumed);
  }

  async function finish() {
    if (!session) return;
    pendingSessions.delete(`${session.date}:${session.kind}:${session.mode}`);
    const frozen = freeze(session, Date.now());
    await save({ ...frozen, status: "done", step: "dominio", endedAt: Date.now(), flow: { ...(frozen.flow ?? emptyFlow()), phase: "bloco" } });
    setConfirmEnd(false);
  }

  async function grade() {
    if (!session || !current || !sub || selected == null || confirmed) return;
    setConfirmed(true);
    setWrongMistakeId(null);
    setErrorReason(null);
    const ok = selected === current.correctIndex;
    let nextFlow = { ...(session.flow ?? emptyFlow()) };
    if (!trap && nextFlow.phase === "diag" && !ok) nextFlow = { ...nextFlow, diagMiss: true, practiceLevel: "facil" };
    if (!trap && nextFlow.phase === "pratica") {
      nextFlow = {
        ...nextFlow,
        practiceAsked: nextFlow.practiceAsked.includes(current.id) ? nextFlow.practiceAsked : [...nextFlow.practiceAsked, current.id],
        practiceLevel: bumpLevel(nextFlow.practiceLevel, ok),
      };
    }
    await save({
      ...session,
      flow: nextFlow,
      correct: session.correct + (ok ? 1 : 0),
      wrong: session.wrong + (ok ? 0 : 1),
      diagCorrect: nextFlow.phase === "diag" && nextFlow.q === 0 ? ok : session.diagCorrect,
      missed: ok || session.missed.includes(current.id) ? session.missed : [...session.missed, current.id],
    });
    if (!ok) {
      const today = saoPauloToday();
      const mistakeId = crypto.randomUUID();
      await study.addMistake({
        id: mistakeId,
        sessionId: session.id,
        date: session.date,
        kind: session.kind,
        topic: sub.title,
        prompt: current.prompt,
        choices: current.choices,
        correctIndex: current.correctIndex,
        userIndex: selected,
        explanation: current.explanation,
        createdAt: Date.now(),
        ...newMistakeSrs(today),
        reviewed: false,
        source: "sessao",
      });
      setWrongMistakeId(mistakeId);
    }
  }

  function advance() {
    if (!session || !sub) return;
    if (trap) {
      setTrap(null);
      return;
    }
    const currentFlow = session.flow ?? emptyFlow();
    if (currentFlow.phase === "diag") {
      if (currentFlow.q < sub.diagnostic.length - 1) {
        void save({ ...session, flow: { ...currentFlow, q: currentFlow.q + 1 } });
        return;
      }
      void save({ ...session, flow: { ...currentFlow, phase: "aula", q: 0 } });
      return;
    }
    if (currentFlow.phase === "pratica") {
      const more = pickPractice(sub, currentFlow);
      if (currentFlow.practiceAsked.length >= 3 || !more) {
        setShownId(null);
        void save({ ...session, flow: { ...currentFlow, phase: "checagem", q: 0 } });
        return;
      }
      setShownId(null);
      void save({ ...session, flow: { ...currentFlow } });
      return;
    }
    if (currentFlow.phase === "checagem") void save({ ...session, flow: { ...currentFlow, phase: "fecho" } });
  }

  function closeSub(status: "ok" | "later") {
    if (!session || !sub) return;
    const currentFlow = session.flow ?? emptyFlow();
    const checks = { ...currentFlow.checks, [sub.id]: status };
    if (currentFlow.sub >= subs.length - 1) {
      void save({ ...session, flow: { ...currentFlow, checks, phase: "bloco" } });
      return;
    }
    setShownId(null);
    void save({ ...session, flow: { ...emptyFlow(), sub: currentFlow.sub + 1, checks } });
  }

  function jump(index: number) {
    if (!session) return;
    const target = subs[index];
    if (!target) return;
    setTrap(null);
    setShownId(null);
    const currentFlow = session.flow ?? emptyFlow();
    void save({
      ...session,
      flow: { ...emptyFlow(), sub: index, checks: currentFlow.checks, phase: currentFlow.checks[target.id] ? "aula" : "diag" },
    });
  }

  function onSelectText() {
    const sel = window.getSelection();
    const text = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (text.length < 12 || text.length > 380) return;
    const parent = sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement;
    if (parent?.closest("button, a, input, textarea")) return;
    setQuote(text);
  }

  const elapsed = session ? liveSeconds(session, now) : 0;
  const studied = Math.floor(elapsed / 60);
  const remainingSec = session ? timerRemainingMs(session.budgetMin, elapsed * 1000) / 1000 : 0;
  const timeUp = session ? timerExpired(session.budgetMin, elapsed * 1000) : false;
  const timerLabel = session?.running ? "Pausar" : elapsed > 0 ? "Retomar" : "Iniciar";
  const doneCount = subs.filter((item) => flow.checks[item.id]).length;
  const asking = Boolean(current && !confirmed && (trap || flow.phase === "diag" || flow.phase === "pratica" || flow.phase === "checagem"));
  const recentMistakes = study.mistakes.filter((item) => item.date === search.dia && item.kind === search.bloco).slice(-5).map((item) => item.prompt);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4" onMouseUp={onSelectText}>
      <header>
        <p className="text-sm text-muted">
          <Link to="/" className="inline-flex min-h-12 items-center underline">Hoje</Link>
          {search.modo === "15" ? " · 15 min" : ""}
        </p>
        <h1 className="mt-1 text-3xl">{pkg?.displayTitle || heading.title}</h1>
        <ul className="mt-2 flex flex-wrap gap-2">
          {(pkg?.codes?.length ? pkg.codes : heading.codes).map((code) => (
            <li key={code} className="rounded-full border border-border px-2 py-1 text-xs text-muted">{code}</li>
          ))}
        </ul>
      </header>

      {!isRichPackage(pkg) && !isModernaBlock(block.content) && block.plannedMin > 0 ? (
        <GeneratePackage date={search.dia} kind={search.bloco} topic={block.content} minutes={block.plannedMin} />
      ) : null}

      {session && session.status === "active" ? (
        <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-bg/95 px-4 backdrop-blur">
          <div className="flex h-12 items-center gap-2">
            <button type="button" className="min-h-12 min-w-0 flex-1 text-left" onClick={() => setBarOpen((v) => !v)} aria-expanded={barOpen}>
              <span className="font-display text-xl tabular-nums" role="timer">{formatClock(elapsed)}</span>
              <span className="ml-3 text-xs text-muted">
                Estudado: {studied} min
                {timeUp ? " · tempo cumprido" : session.running ? ` · restam ${formatClock(remainingSec)}` : ""}
                {flow.phase === "aula" && !barOpen ? " · toque para as seções" : ""}
              </span>
            </button>
            <Button onClick={toggleTimer}>{timerLabel}</Button>
          </div>
          {barOpen ? (
            <div className="flex flex-col gap-2 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="surface" onClick={() => void save({ ...session, bonusMin: session.bonusMin + 5, budgetMin: session.budgetMin + 5 })}>+5 min</Button>
                <Button variant="ghost" onClick={() => setConfirmEnd(true)}>Encerrar</Button>
                <p className="text-xs text-muted">Meta deste modo: {formatMin(session.budgetMin)}</p>
              </div>
              {flow.phase === "aula" && !trap ? (
                <nav className="flex gap-2 overflow-x-auto" aria-label="Seções da aula">
                  {SECTIONS.map(([id, label]) => (
                    <button key={id} type="button" className="min-h-12 shrink-0 rounded-full border border-border px-3 py-2 text-xs" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                      {label}
                    </button>
                  ))}
                  <button type="button" className="min-h-12 shrink-0 rounded-full border border-border px-3 py-2 text-xs" onClick={() => void save({ ...session, flow: { ...flow, phase: "pratica", q: 0 } })}>
                    Praticar
                  </button>
                </nav>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {session && timeUp && session.status === "active" ? (
        <section className="rounded-xl border border-primary/40 bg-surface p-4">
          <p className="text-xs text-primary">Tempo do bloco cumprido</p>
          <p className="mt-1 text-sm leading-relaxed">
            Você já cumpriu {formatMin(Math.max(1, session.budgetMin))} neste bloco. Fecha o bloco agora ou estica mais 5 min.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="surface"
              onClick={() => {
                const nowMs = Date.now();
                setNow(nowMs);
                void save({ ...session, bonusMin: session.bonusMin + 5, budgetMin: session.budgetMin + 5 });
              }}
            >
              +5 min
            </Button>
            <Button onClick={() => setConfirmEnd(true)}>Encerrar bloco</Button>
          </div>
        </section>
      ) : null}

      {confirmEnd ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <p>Encerrar e salvar o tempo estudado até aqui?</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void finish()}>Salvar e encerrar</Button>
            <Button variant="ghost" onClick={() => setConfirmEnd(false)}>Continuar estudando</Button>
          </div>
        </section>
      ) : null}

      {subs.length ? (
        <section>
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-primary" style={{ width: `${subs.length ? Math.round((doneCount / subs.length) * 100) : 0}%` }} />
          </div>
          <ul className="flex flex-col gap-2">
            {subs.map((item, index) => {
              const state = flow.checks[item.id];
              const here = index === flow.sub && session?.status === "active" && flow.phase !== "bloco";
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => jump(index)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left">
                    <span>
                      <span className="mr-2 text-xs text-primary">{item.code}</span>
                      {item.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{here ? "agora" : state === "ok" ? "entendido" : state === "later" ? "revisar" : `${item.minutes} min`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {!pkg ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-2xl">A aula deste bloco ainda não está neste aparelho</h2>
          <Button
            className="mt-4"
            disabled={building}
            onClick={() => {
              setBuilding(true);
              void study.buildOne(search.dia, search.bloco).then((error) => {
                setBuildError(error ?? "");
                setBuilding(false);
              });
            }}
          >
            {building ? "Montando…" : "Montar esta aula"}
          </Button>
          {buildError ? <p className="mt-3 text-sm text-clay-text">{buildError}</p> : null}
        </section>
      ) : null}

      {pkg && session && sub && session.status === "active" && flow.phase !== "bloco" && !trap && (flow.phase === "diag" || flow.phase === "pratica" || flow.phase === "checagem") && current ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-primary">
            {flow.phase === "diag" ? `Diagnóstico · ${flow.q + 1} de ${sub.diagnostic.length}` : flow.phase === "checagem" ? "Checagem de domínio" : `Prática · ${flow.practiceLevel}`}
          </p>
          {flow.phase === "diag" && flow.diagMiss && flow.q > 0 && !confirmed ? (
            <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">Vamos do básico. {sub.concepts[0]?.meaning}</p>
          ) : null}
          <div className="mt-3">
            <QuestionCard item={current} selected={selected} confirmed={confirmed} showHint={showHint} altText="" onSelect={setSelected} onHint={() => setShowHint(true)} onOther={() => undefined} otherBusy={false} />
          </div>
          {!confirmed ? (
            <Button className="mt-4" disabled={selected == null} onClick={() => void grade()}>Confirmar</Button>
          ) : (
            <Button className="mt-4" onClick={advance}>{flow.phase === "diag" && flow.q >= sub.diagnostic.length - 1 ? "Ir para a aula" : flow.phase === "checagem" ? "Ver o fechamento" : "Continuar"}</Button>
          )}
        </section>
      ) : null}

      {pkg && session && sub && trap ? (
        <section className="rounded-xl border border-clay/40 bg-surface p-4">
          <p className="text-xs text-clay-text">Pegadinha</p>
          <div className="mt-3">
            <QuestionCard item={trap} selected={selected} confirmed={confirmed} showHint={showHint} altText="" onSelect={setSelected} onHint={() => setShowHint(true)} onOther={() => undefined} otherBusy={false} />
          </div>
          {!confirmed ? (
            <Button className="mt-4" disabled={selected == null} onClick={() => void grade()}>Confirmar</Button>
          ) : (
            <Button className="mt-4" variant="surface" onClick={() => setTrap(null)}>Voltar à aula</Button>
          )}
        </section>
      ) : null}

      {confirmed && wrongMistakeId ? (
        <section className="rounded-xl border border-clay/40 bg-surface p-4">
          <p className="text-xs text-clay-text">Erro guardado no caderno</p>
          <ErrorReasonPicker
            className="mt-2"
            label="Classifique rápido a causa (opcional)"
            value={errorReason ?? undefined}
            onChange={(reason) => {
              setErrorReason(reason);
              void study.setMistakeErrorReason(wrongMistakeId, reason);
            }}
          />
          <p className="mt-2 text-xs text-muted">A revisão espaçada já deixou este erro para hoje.</p>
        </section>
      ) : null}

      {pkg && pkg.flashcards.length && flow.phase === "aula" && !trap ? <FlashcardDeck cards={pkg.flashcards} /> : null}

      {pkg && session && sub && session.status === "active" && flow.phase === "aula" && !trap ? (
        <LessonView sub={sub} onTrain={(item) => { setTrap(item); setConfirmed(false); setSelected(null); setShowHint(false); }} />
      ) : null}

      {pkg && session && sub && flow.phase === "aula" && !trap ? (
        <Button onClick={() => void save({ ...session, flow: { ...flow, phase: "pratica", q: 0 } })}>Ir para a prática</Button>
      ) : null}

      {session && sub && flow.phase === "fecho" ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-2xl">{sub.title}</h2>
          <p className="mt-2 text-sm text-muted">Marque como você ficou neste subtópico. Dá para voltar pelo checklist.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => closeSub("ok")}>Entendi</Button>
            <Button variant="surface" onClick={() => closeSub("later")}>Revisar depois</Button>
          </div>
        </section>
      ) : null}

      {session && (flow.phase === "bloco" || session.status === "done") ? (
        <section className="rounded-xl border border-primary/40 bg-surface p-5">
          <p className="text-xs text-primary">Checagem do bloco</p>
          <h2 className="mt-1 text-3xl">{doneCount === subs.length && subs.length ? "Bloco percorrido" : "Parou no meio"}</h2>
          <p className="mt-2 text-sm text-muted">Estudado: {formatMin(Math.round((session.status === "done" ? session.elapsedSec : elapsed) / 60))} · {session.correct} acertos · {session.wrong} erros</p>
          <ul className="mt-3 space-y-1 text-sm">
            {subs.map((item) => (
              <li key={item.id}>{item.code} · {flow.checks[item.id] === "ok" ? "entendido" : flow.checks[item.id] === "later" ? "revisar depois" : "ainda não fechou"}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild><Link to="/">Hoje</Link></Button>
            <Button variant="surface" asChild><Link to="/erros">Caderno de erros</Link></Button>
          </div>
        </section>
      ) : null}

      {pkg?.sources.length && flow.phase === "aula" ? (
        <ul className="text-xs leading-relaxed text-muted">
          {pkg.sources.map((source) => (
            <li key={source.title}>
              {source.url ? <a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}
              {source.note ? ` — ${source.note}` : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {quote && !chat ? (
        <button type="button" className="fixed bottom-44 right-4 z-40 min-h-12 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-fg" onClick={() => setChat(true)}>
          Perguntar sobre isso
        </button>
      ) : null}
      {!chat ? (
        <button type="button" className="fixed bottom-28 right-4 z-40 min-h-12 rounded-full border border-primary bg-bg px-4 text-sm font-semibold text-primary md:bottom-6" onClick={() => setChat(true)}>
          Perguntar ao professor
        </button>
      ) : null}
      <TeacherChat
        open={chat}
        onClose={() => setChat(false)}
        blockId={`${search.dia}:${search.bloco}`}
        title={pkg?.displayTitle || heading.title}
        subtopic={sub?.title ?? ""}
        brief={pkg ? briefOf(pkg, sub) : ""}
        holdAnswer={asking}
        question={asking && current ? `${current.prompt} ${current.choices.join(" | ")}` : ""}
        mistakes={recentMistakes}
        userKey={study.settings.keys.xai}
        pkg={pkg ?? null}
        diagramSvg={sub?.diagramSvg ?? ""}
        doubts={study.doubts}
        onSaveDoubt={(doubt) => void study.saveDoubt(doubt)}
        onSavePackage={(next) => void study.saveBuilt(next)}
        makeTest={() => sub?.practice.find((item) => !(session?.flow?.practiceAsked ?? []).includes(item.id)) ?? sub?.mastery ?? null}
        quote={quote}
        onQuoteUsed={() => setQuote(null)}
        questionId={asking && current ? current.id : undefined}
      />
    </div>
  );
}
