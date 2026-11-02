import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { generatePackageClient } from "@/lib/ai/xai-client";
import { EMPTY_KEYS, loadKeys, setKeys, type KeyValues } from "@/lib/secure/keys";
import { coverageProblems, isModernaBlock } from "@/lib/study/coverage";
import { loadSnapshot, saveDays, saveMeta, saveMistake, savePackage, saveSession } from "@/lib/study/db";
import { buildHumanasPackage } from "@/lib/study/humanas-pack";
import { SEED_DAYS } from "@/lib/study/seed";
import { scheduleReview, type SrsOutcome } from "@/lib/study/srs";
import { addDays, saoPauloToday } from "@/lib/study/time";
import type { BlockKind, Doubt, ErrorReason, Mistake, PlanDay, ResearcherId, Settings, StudyPackage, StudySession } from "@/lib/study/types";
import { EMPTY_SETTINGS, KIND_LABEL } from "@/lib/study/types";

export type PrepState = {
  running: boolean;
  total: number;
  done: number;
  current: string;
  failures: { label: string; error: string }[];
};

type Snapshot = {
  days: PlanDay[];
  packages: StudyPackage[];
  sessions: StudySession[];
  mistakes: Mistake[];
  doubts: Doubt[];
  settings: Settings;
  /** Chaves do serviço de armazenamento seguro (nunca de `settings`). */
  keys: KeyValues;
  notifyLog: Record<string, string>;
  seeded: boolean;
  /** Introdução (/boas-vindas) concluída; vem de `meta.onboardingDone`. */
  onboardingDone: boolean;
  /** Segunda-feira da semana em que "Preparar semana" foi dispensado. */
  prepDismissedWeek: string;
};

type StudyApi = Snapshot & {
  ready: boolean;
  loadError: string;
  prep: PrepState;
  importDays: (days: PlanDay[]) => Promise<void>;
  /** Cria ou substitui um dia inteiro (usado pela edição manual do plano). */
  upsertDay: (day: PlanDay) => Promise<void>;
  saveSettings: (settings: Settings, keys: KeyValues) => Promise<void>;
  /** Marca a introdução como concluída/pulada e grava em `meta.onboardingDone`. */
  completeOnboarding: () => Promise<void>;
  rememberNotify: (log: Record<string, string>) => void;
  upsertSession: (session: StudySession) => Promise<void>;
  addMistake: (mistake: Mistake) => Promise<void>;
  reviewMistake: (id: string) => Promise<void>;
  /** Revisão espaçada: agenda +1/+3/+7… dias conforme a retenção escolhida. */
  reviewMistakeSrs: (id: string, outcome: SrsOutcome, today?: string) => Promise<void>;
  /** Classificação rápida da causa do erro (Teoria, Atenção, Interpretação, Tempo). */
  setMistakeErrorReason: (id: string, reason: ErrorReason) => Promise<void>;
  saveDoubt: (doubt: Doubt) => Promise<void>;
  saveBuilt: (pkg: StudyPackage) => Promise<void>;
  packageFor: (date: string, kind: BlockKind) => StudyPackage | undefined;
  buildOne: (date: string, kind: BlockKind) => Promise<string | null>;
  startPrep: (fromDate: string) => void;
  cancelPrep: () => void;
  /** Dispensa a sugestão "Preparar semana" na semana de `weekKey` (YYYY-MM-DD). */
  dismissPrepWeek: (weekKey: string) => Promise<void>;
};

const IDLE_PREP: PrepState = { running: false, total: 0, done: 0, current: "", failures: [] };

const Ctx = createContext<StudyApi | null>(null);

function researcherKey(settings: Settings, keys: KeyValues): string {
  const map: Record<ResearcherId, string> = {
    grok: keys.xai,
    perplexity: keys.perplexity,
    gemini: keys.gemini,
    claude: keys.claude,
  };
  return map[settings.researcher] ?? "";
}

export function StudyProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>({
    days: [],
    packages: [],
    sessions: [],
    mistakes: [],
    doubts: [],
    settings: EMPTY_SETTINGS,
    keys: EMPTY_KEYS,
    notifyLog: {},
    seeded: false,
    onboardingDone: false,
    prepDismissedWeek: "",
  });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [prep, setPrep] = useState<PrepState>(IDLE_PREP);
  const cancelRef = useRef(false);
  const prepLock = useRef(false);
  const snapRef = useRef(snap);
  snapRef.current = snap;

  // Pede ao navegador para não despejar o IndexedDB por inatividade (iOS e
  // Android). Silencioso quando a API não existe ou o navegador nega.
  useEffect(() => {
    try {
      const request = navigator.storage?.persist?.();
      if (request) void request.catch(() => undefined);
    } catch {
      // Storage API indisponível: o backup manual continua sendo a proteção.
    }
  }, []);

  useEffect(() => {
    let live = true;
    loadSnapshot()
      .then(async (loaded) => {
        if (!loaded.days.length) {
          await saveDays(SEED_DAYS);
          await saveMeta("seeded", true);
          loaded.days = SEED_DAYS;
          loaded.seeded = true;
        }
        // No Android isto migra `settings.keys` para o Keystore e apaga do
        // IndexedDB; na web lê o mesmo IndexedDB de sempre.
        const keys = await loadKeys();
        if (!live) return;
        setSnap({
          days: loaded.days,
          packages: loaded.packages,
          sessions: loaded.sessions,
          mistakes: loaded.mistakes,
          doubts: loaded.doubts,
          settings: loaded.settings,
          keys,
          notifyLog: loaded.notifyLog,
          seeded: loaded.seeded,
          onboardingDone: loaded.onboardingDone,
          prepDismissedWeek: loaded.prepDismissedWeek,
        });
      })
      .catch(() => {
        if (live) setLoadError("Não consegui abrir os dados neste aparelho.");
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const importDays = useCallback(async (days: PlanDay[]) => {
    await saveDays(days);
    setSnap((s) => ({ ...s, days, seeded: false }));
  }, []);

  /**
   * Cria ou substitui um dia do plano (edição manual no celular).
   * Mantém a lista ordenada por data e grava tudo em `days`.
   */
  const upsertDay = useCallback(async (day: PlanDay) => {
    const next = [...snapRef.current.days.filter((item) => item.date !== day.date), day].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    await saveDays(next);
    setSnap((s) => ({ ...s, days: next, seeded: false }));
  }, []);

  const saveSettings = useCallback(async (settings: Settings, keys: KeyValues) => {
    // Ajustes vão sem chaves para o IndexedDB; as chaves passam pelo serviço
    // (Keystore no Android, `settings.keys` no IndexedDB da web).
    await saveMeta("settings", settings);
    await setKeys(keys);
    setSnap((s) => ({ ...s, settings, keys }));
  }, []);

  /** Conclui (ou pula) a introdução uma única vez; grava só a flag. */
  const completeOnboarding = useCallback(async () => {
    await saveMeta("onboardingDone", true);
    setSnap((s) => (s.onboardingDone ? s : { ...s, onboardingDone: true }));
  }, []);

  const rememberNotify = useCallback((log: Record<string, string>) => {
    setSnap((s) => ({ ...s, notifyLog: log }));
    void saveMeta("notifyLog", log);
  }, []);

  const upsertSession = useCallback(async (session: StudySession) => {
    await saveSession(session);
    setSnap((s) => ({
      ...s,
      sessions: [...s.sessions.filter((item) => item.id !== session.id), session],
    }));
  }, []);

  const addMistake = useCallback(async (mistake: Mistake) => {
    await saveMistake(mistake);
    setSnap((s) => ({ ...s, mistakes: [...s.mistakes.filter((item) => item.id !== mistake.id), mistake] }));
  }, []);

  const reviewMistake = useCallback(async (id: string) => {
    const current = snapRef.current.mistakes.find((item) => item.id === id);
    if (!current) return;
    const next = { ...current, reviewed: true };
    await saveMistake(next);
    setSnap((s) => ({ ...s, mistakes: s.mistakes.map((item) => (item.id === id ? next : item)) }));
  }, []);

  const reviewMistakeSrs = useCallback(async (id: string, outcome: SrsOutcome, today = saoPauloToday()) => {
    const current = snapRef.current.mistakes.find((item) => item.id === id);
    if (!current) return;
    const next = scheduleReview(current, outcome, today);
    await saveMistake(next);
    setSnap((s) => ({ ...s, mistakes: s.mistakes.map((item) => (item.id === id ? next : item)) }));
  }, []);

  const setMistakeErrorReason = useCallback(async (id: string, reason: ErrorReason) => {
    const current = snapRef.current.mistakes.find((item) => item.id === id);
    if (!current) return;
    const next = { ...current, errorReason: reason };
    await saveMistake(next);
    setSnap((s) => ({ ...s, mistakes: s.mistakes.map((item) => (item.id === id ? next : item)) }));
  }, []);

  const saveBuilt = useCallback(async (pkg: StudyPackage) => {
    await savePackage(pkg);
    setSnap((s) => ({ ...s, packages: [...s.packages.filter((item) => item.id !== pkg.id), pkg] }));
  }, []);

  const saveDoubt = useCallback(async (doubt: Doubt) => {
    const next = [...snapRef.current.doubts.filter((item) => item.id !== doubt.id), doubt].slice(-80);
    await saveMeta("doubts", next);
    setSnap((s) => ({ ...s, doubts: next }));
  }, []);

  const packageFor = useCallback(
    (date: string, kind: BlockKind) => snap.packages.find((item) => item.id === `${date}:${kind}`),
    [snap.packages],
  );

  const buildOne = useCallback(async (date: string, kind: BlockKind) => {
    const day = snapRef.current.days.find((item) => item.date === date);
    const block = day?.blocks.find((item) => item.kind === kind);
    if (!block || block.plannedMin <= 0) return "Esse bloco não tem tempo de estudo.";
    if (isModernaBlock(block.content)) {
      const pkg = buildHumanasPackage({ id: `${date}:${kind}`, date, kind, topic: block.content });
      const problems = coverageProblems(pkg, block.content);
      if (problems.length) return problems[0] ?? "Aula incompleta.";
      await saveBuilt(pkg);
      return null;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) return "Sem internet. O pacote fica para quando a rede voltar.";
    const { settings, keys } = snapRef.current;
    let gaps = "";
    let lastError = "A aula veio incompleta.";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await generatePackageClient({
        topic: block.content,
        minutes: block.plannedMin,
        provider: settings.researcher,
        userKey: researcherKey(settings, keys),
        webSearch: settings.webSearch,
        gaps,
      });
      if (!res.ok) return res.error;
      const pkg: StudyPackage = {
        ...res.data,
        id: `${date}:${kind}`,
        date,
        kind,
        topic: block.content,
        generatedAt: Date.now(),
      };
      const problems = coverageProblems(pkg, block.content);
      if (!problems.length) {
        await saveBuilt(pkg);
        return null;
      }
      gaps = problems.slice(0, 6).join(" ");
      lastError = problems[0] ?? lastError;
    }
    return `A aula ainda ficou incompleta: ${lastError}`;
  }, [saveBuilt]);

  const cancelPrep = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const dismissPrepWeek = useCallback(async (weekKey: string) => {
    await saveMeta("prepDismissedWeek", weekKey);
    setSnap((s) => ({ ...s, prepDismissedWeek: weekKey }));
  }, []);

  const startPrep = useCallback((fromDate: string) => {
    if (prepLock.current) return;
    const { days, packages } = snapRef.current;
    const targets: { date: string; kind: BlockKind; label: string }[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(fromDate, offset);
      const day = days.find((item) => item.date === date);
      if (!day) continue;
      for (const block of day.blocks) {
        if (block.plannedMin <= 0) continue;
        if (packages.some((item) => item.id === `${date}:${block.kind}`)) continue;
        targets.push({ date, kind: block.kind, label: `${date} · ${KIND_LABEL[block.kind]}` });
      }
    }
    if (!targets.length) {
      setPrep({ running: false, total: 0, done: 0, current: "Nada pendente nesta semana.", failures: [] });
      return;
    }
    cancelRef.current = false;
    prepLock.current = true;
    setPrep({ running: true, total: targets.length, done: 0, current: targets[0]?.label ?? "", failures: [] });
    void (async () => {
      const failures: { label: string; error: string }[] = [];
      for (let i = 0; i < targets.length; i += 1) {
        if (cancelRef.current) break;
        const target = targets[i];
        if (!target) continue;
        setPrep((p) => ({ ...p, current: target.label, done: i }));
        const error = await buildOne(target.date, target.kind);
        if (error) failures.push({ label: target.label, error });
      }
      setPrep({
        running: false,
        total: targets.length,
        done: cancelRef.current ? 0 : targets.length,
        current: cancelRef.current ? "Interrompido." : "Semana preparada.",
        failures,
      });
      prepLock.current = false;
    })();
  }, [buildOne]);

  const api = useMemo<StudyApi>(
    () => ({
      ...snap,
      ready,
      loadError,
      prep,
      importDays,
      upsertDay,
      saveSettings,
      completeOnboarding,
      rememberNotify,
      upsertSession,
      addMistake,
      reviewMistake,
      reviewMistakeSrs,
      setMistakeErrorReason,
      saveDoubt,
      saveBuilt,
      packageFor,
      buildOne,
      startPrep,
      cancelPrep,
      dismissPrepWeek,
    }),
    [snap, ready, loadError, prep, importDays, upsertDay, saveSettings, completeOnboarding, rememberNotify, upsertSession, addMistake, reviewMistake, reviewMistakeSrs, setMistakeErrorReason, saveDoubt, saveBuilt, packageFor, buildOne, startPrep, cancelPrep, dismissPrepWeek],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStudy(): StudyApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudy fora do plano");
  return ctx;
}
