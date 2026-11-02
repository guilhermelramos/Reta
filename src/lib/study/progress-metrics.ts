import { addDays, dayLoad, daysBetween, examDate } from "./time.ts";
import type { BlockKind, ErrorReason, Mistake, PlanDay, StudySession } from "./types.ts";
import { ERROR_REASON_LABEL, KIND_LABEL } from "./types.ts";

/**
 * Métricas do painel de progresso. Tudo aqui é função pura: a data de hoje
 * entra por parâmetro para o cálculo ser determinístico e testável.
 */

export type ConsistencyState = "meta" | "parcial" | "branco" | "livre";

export type ConsistencyCell = {
  date: string;
  state: ConsistencyState;
  plannedMin: number;
  studiedMin: number;
  isToday: boolean;
};

export type ConsistencySummary = {
  cells: ConsistencyCell[];
  windowDays: number;
  streak: number;
  metDays: number;
  partialDays: number;
  blankDays: number;
  restDays: number;
  studiedMin: number;
  plannedMin: number;
  goalPct: number;
};

export type WeakTopic = {
  key: string;
  label: string;
  correct: number;
  wrong: number;
  total: number;
  /** 0 a 100. */
  accuracy: number;
};

export type ErrorReasonKey = ErrorReason | "sem_causa";

export type ErrorReasonRow = {
  key: ErrorReasonKey;
  label: string;
  count: number;
  /** 0 a 100 em relação ao total de erros. */
  pct: number;
};

export type RetaCoverage = {
  endDate: string | null;
  planned: number;
  done: number;
  /** 0 a 100. */
  pct: number;
  /** Cobertura esperada se todos os blocos até hoje estivessem concluídos. */
  expectedPct: number;
  daysLeft: number;
  status: "vazio" | "adiantado" | "no ritmo" | "atrasado";
};

/**
 * Datas com algum tempo realmente estudado.
 *
 * Abrir um bloco cria uma sessão com `elapsedSec: 0`; ela não pode contar como
 * dia estudado. Só entra quem já acumulou segundos, independentemente de a
 * sessão estar ativa ou concluída.
 */
export function studiedDates(sessions: StudySession[]): Set<string> {
  return new Set(
    sessions
      .filter((s) => Number.isFinite(s.elapsedSec) && s.elapsedSec > 0)
      .map((s) => s.date)
      .filter(Boolean),
  );
}

/** Minutos estudados por dia, somando todas as sessões daquele dia. */
export function sessionMinutesByDate(sessions: StudySession[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const session of sessions) {
    if (!session?.date) continue;
    const seconds = Number.isFinite(session.elapsedSec) ? Math.max(0, session.elapsedSec) : 0;
    if (!(session.status === "done" || session.status === "active" || seconds >= 60)) continue;
    map.set(session.date, (map.get(session.date) ?? 0) + seconds / 60);
  }
  return map;
}

/**
 * Sequência atual: dias consecutivos com minutos estudados, terminando hoje
 * (ou ontem, quando hoje ainda não tem estudo).
 *
 * Usa a mesma fonte e a mesma chave de data do mapa de calor
 * (`sessionMinutesByDate` + `YYYY-MM-DD`), então sete quadrados pintados em
 * sequência valem exatamente sete na métrica. O plano não entra na conta:
 * dias fora dele também aparecem no heatmap.
 */
export function currentStreak(
  _days: PlanDay[],
  sessions: StudySession[],
  today: string,
): number {
  const minutes = sessionMinutesByDate(sessions);
  const studied = (date: string) => (minutes.get(date) ?? 0) > 0;
  let cursor = studied(today) ? today : addDays(today, -1);
  let count = 0;
  for (let i = 0; i < 3650; i += 1) {
    if (!studied(cursor)) break;
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/**
 * Heatmap dos últimos N dias (padrão 28) com quatro estados:
 * meta batida, parcial (inclusive quem usou o modo 15 min), em branco e dia
 * livre do plano.
 */
export function buildConsistency(input: {
  days: PlanDay[];
  sessions: StudySession[];
  today: string;
  windowDays?: number;
}): ConsistencySummary {
  const { days, sessions, today } = input;
  const windowDays = Math.max(1, Math.round(input.windowDays ?? 28));
  const studied = sessionMinutesByDate(sessions);
  const quickMode = new Set(sessions.filter((s) => s.mode === "15").map((s) => s.date));
  const dayByDate = new Map(days.map((day) => [day.date, day]));

  const cells: ConsistencyCell[] = [];
  let metDays = 0;
  let partialDays = 0;
  let blankDays = 0;
  let restDays = 0;
  let studiedMin = 0;
  let plannedMin = 0;

  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const day = dayByDate.get(date);
    const planned = day ? dayLoad(day) : 0;
    const studiedRaw = studied.get(date) ?? 0;
    const studiedToday = Math.round(studiedRaw);
    const isQuick = quickMode.has(date);

    let state: ConsistencyState;
    if (planned > 0) {
      if (studiedToday >= Math.max(1, planned - 1)) state = "meta";
      else if (studiedToday > 0 || isQuick) state = "parcial";
      else state = "branco";
    } else if (studiedToday >= 15) {
      state = "meta";
    } else if (studiedToday > 0 || isQuick) {
      state = "parcial";
    } else {
      state = day ? "livre" : "branco";
    }

    if (state === "meta") metDays += 1;
    else if (state === "parcial") partialDays += 1;
    else if (state === "livre") restDays += 1;
    else blankDays += 1;

    studiedMin += studiedToday;
    plannedMin += planned;

    cells.push({ date, state, plannedMin: planned, studiedMin: studiedToday, isToday: date === today });
  }

  return {
    cells,
    windowDays,
    streak: currentStreak(days, sessions, today),
    metDays,
    partialDays,
    blankDays,
    restDays,
    studiedMin,
    plannedMin,
    goalPct: plannedMin > 0 ? Math.min(100, Math.round((studiedMin / plannedMin) * 100)) : 0,
  };
}

/** Etiqueta curta para um bloco do plano ("Matemática", "Biologia"...). */
export function planTopicLabel(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) return "Bloco";
  const head = clean.split(/[.:;–—]/)[0]?.trim() ?? clean;
  const label = head.length >= 3 ? head : clean;
  return label.length > 48 ? `${label.slice(0, 47).trimEnd()}…` : label;
}

export function labelKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Matéria do bloco correspondente (A/B/R) no dia do plano, ou `null` quando o
 * plano não tem esse dia/bloco com conteúdo.
 */
export function planBlockSubject(
  days: PlanDay[],
  date: string,
  kind: BlockKind,
): string | null {
  const day = days.find((item) => item.date === date);
  if (!day) return null;
  const block = day.blocks.find((item) => item.kind === kind);
  if (!block) return null;
  const label = planTopicLabel(block.content);
  return label && label !== "Bloco" ? label : null;
}

/**
 * Matéria de uma sessão/questão: a própria, quando existe, ou a do bloco do
 * plano na mesma data. O rótulo do tipo ("Bloco A", "Bloco B") é o último
 * recurso, só quando o plano não tem aquele dia.
 */
export function resolveSubject(input: {
  days: PlanDay[];
  date: string;
  kind: BlockKind;
  own?: string;
}): string {
  const own = input.own?.trim();
  if (own) return own;
  return planBlockSubject(input.days, input.date, input.kind) ?? KIND_LABEL[input.kind] ?? "Bloco";
}

type TopicAccumulator = { label: string; correct: number; wrong: number };

/**
 * Ranking dos tópicos/matérias com menor taxa de acerto.
 *
 * A taxa vem das sessões (que guardam acertos e erros do bloco). Erros do
 * caderno cuja sessão não existe mais entram como uma questão errada, e erros
 * externos entram pela matéria anotada — assim o painel nunca fica vazio só
 * porque o histórico de sessões foi apagado.
 */
export function weakTopicRanking(input: {
  days: PlanDay[];
  sessions: StudySession[];
  mistakes: Mistake[];
  limit?: number;
}): WeakTopic[] {
  const { days, sessions, mistakes } = input;
  const limit = Math.max(1, Math.round(input.limit ?? 5));

  const groups = new Map<string, TopicAccumulator>();
  const add = (label: string, correct: number, wrong: number) => {
    const clean = label.trim();
    if (!clean) return;
    const key = labelKey(clean);
    if (!key) return;
    const current = groups.get(key) ?? { label: clean, correct: 0, wrong: 0 };
    current.correct += correct;
    current.wrong += wrong;
    groups.set(key, current);
  };

  const seenSessions = new Set<string>();
  for (const session of sessions) {
    seenSessions.add(session.id);
    const total = (session.correct ?? 0) + (session.wrong ?? 0);
    if (total <= 0) continue;
    const label = resolveSubject({
      days,
      date: session.date,
      kind: session.kind,
      own: session.subject,
    });
    add(label, session.correct ?? 0, session.wrong ?? 0);
  }

  for (const mistake of mistakes) {
    const external = mistake.sessionId === "externo" || mistake.source === "externo";
    if (!external && seenSessions.has(mistake.sessionId)) continue;
    const label = resolveSubject({
      days,
      date: mistake.date,
      kind: mistake.kind,
      own: mistake.subject,
    });
    add(label, 0, 1);
  }

  return [...groups.values()]
    .filter((group) => group.correct + group.wrong > 0)
    .map((group) => {
      const total = group.correct + group.wrong;
      return {
        key: labelKey(group.label),
        label: group.label,
        correct: group.correct,
        wrong: group.wrong,
        total,
        accuracy: Math.round((group.correct / total) * 100),
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong || b.total - a.total)
    .slice(0, limit);
}

const REASON_ORDER: ErrorReason[] = ["lacuna_teorica", "atencao", "interpretacao", "tempo"];

/** Distribuição dos motivos de erro, com "Sem causa" para registros antigos. */
export function errorReasonDistribution(mistakes: Mistake[]): ErrorReasonRow[] {
  const counts = new Map<ErrorReasonKey, number>();
  for (const reason of REASON_ORDER) counts.set(reason, 0);
  counts.set("sem_causa", 0);
  let total = 0;
  for (const mistake of mistakes) {
    const reason = mistake.errorReason;
    const key: ErrorReasonKey = reason && REASON_ORDER.includes(reason) ? reason : "sem_causa";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total += 1;
  }
  const rows: ErrorReasonRow[] = REASON_ORDER.map((reason) => ({
    key: reason,
    label: ERROR_REASON_LABEL[reason],
    count: counts.get(reason) ?? 0,
    pct: total > 0 ? Math.round(((counts.get(reason) ?? 0) / total) * 100) : 0,
  }));
  rows.push({
    key: "sem_causa",
    label: "Sem causa",
    count: counts.get("sem_causa") ?? 0,
    pct: total > 0 ? Math.round(((counts.get("sem_causa") ?? 0) / total) * 100) : 0,
  });
  return rows;
}

/**
 * Termômetro da Reta: quanto dos blocos planejados (com tempo > 0) já foi
 * concluído, comparado com o que era esperado até hoje.
 */
export function retaCoverage(days: PlanDay[], sessions: StudySession[], today: string): RetaCoverage {
  const plannedBlocks = days.flatMap((day) =>
    day.blocks.filter((block) => block.plannedMin > 0).map((block) => ({ date: day.date, kind: block.kind })),
  );
  const planned = plannedBlocks.length;
  const endDate = examDate(days);

  if (!planned || !endDate) {
    return { endDate, planned: 0, done: 0, pct: 0, expectedPct: 0, daysLeft: 0, status: "vazio" };
  }

  const doneKeys = new Set(
    sessions.filter((session) => session.status === "done").map((session) => `${session.date}:${session.kind}`),
  );
  const done = plannedBlocks.filter((block) => doneKeys.has(`${block.date}:${block.kind}`)).length;
  const expectedBlocks = plannedBlocks.filter((block) => block.date <= today).length;

  const pct = Math.round((done / planned) * 100);
  const expectedPct = Math.round((expectedBlocks / planned) * 100);
  const status: RetaCoverage["status"] =
    pct >= expectedPct + 5 ? "adiantado" : pct >= expectedPct - 5 ? "no ritmo" : "atrasado";

  return {
    endDate,
    planned,
    done,
    pct,
    expectedPct,
    daysLeft: daysBetween(today, endDate),
    status,
  };
}
