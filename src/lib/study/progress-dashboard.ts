import type { ErrorCopy } from "../feedback/error-copy.ts";
import {
  buildConsistency,
  currentStreak,
  errorReasonDistribution,
  labelKey,
  planTopicLabel,
  retaCoverage,
  sessionMinutesByDate,
  weakTopicRanking,
  type ErrorReasonRow,
  type RetaCoverage,
  type WeakTopic,
} from "./progress-metrics.ts";
import { addDays, dayLoad, daysBetween, examDate } from "./time.ts";
import type { Mistake, PlanDay, StudySession } from "./types.ts";
import { KIND_LABEL } from "./types.ts";

/**
 * Leitura pura da tela Progresso.
 *
 * A tela recebe plano, sessões e erros já carregados do IndexedDB e estas
 * funções decidem o que mostrar: a contagem até a prova, as três métricas da
 * primeira dobra, a escala e as semanas do mapa de calor, o planejado × real
 * por assunto, os motivos de erro e o estado compacto dos dias do plano.
 * Nada aqui depende de React, para os testes em Node cobrirem as contas.
 */

const WEEKDAY_INITIALS = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

/** `YYYY-MM-DD` → 0 = domingo … 6 = sábado (UTC, sem horário de verão). */
function weekday(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return 0;
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

/** Segunda-feira da semana que contém a data. */
export function weekStart(dateKey: string): string {
  return addDays(dateKey, -((weekday(dateKey) + 6) % 7));
}

/** Domingo da mesma semana. */
export function weekEnd(dateKey: string): string {
  return addDays(weekStart(dateKey), 6);
}

/** `2026-11-05` → `05/11`. */
export function dayMonth(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${d}/${m}`;
}

/** "0min", "45min", "1h", "1h30", "10h05" — cabe no número grande do cartão. */
export function formatHoursCompact(min: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(min) ? min : 0));
  if (total < 60) return `${total}min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export type ExamCountdown = {
  /** `null` quando o plano não tem data de prova. */
  daysLeft: number | null;
  label: string;
};

/** Linha do topo: "Faltam N dias para a prova". */
export function examCountdown(days: PlanDay[], today: string): ExamCountdown {
  const end = examDate(days);
  if (!end) return { daysLeft: null, label: "Sem data de prova no plano" };
  const left = daysBetween(today, end);
  if (left > 0) {
    return {
      daysLeft: left,
      label: left === 1 ? "Falta 1 dia para a prova" : `Faltam ${left} dias para a prova`,
    };
  }
  if (left === 0) return { daysLeft: 0, label: "A prova é hoje" };
  return { daysLeft: left, label: "A data da prova já passou" };
}

export type WeekProgress = {
  start: string;
  end: string;
  studiedMin: number;
  plannedMin: number;
  /** 0 a 100 (pode passar de 100 se estudou além do plano). */
  pct: number;
};

/** Minutos estudados e planejados na semana (segunda a domingo) de `today`. */
export function weekProgress(
  days: PlanDay[],
  sessions: StudySession[],
  today: string,
): WeekProgress {
  const start = weekStart(today);
  const end = weekEnd(today);
  const studiedByDate = sessionMinutesByDate(sessions);
  const dayByDate = new Map(days.map((day) => [day.date, day]));

  let studiedMin = 0;
  let plannedMin = 0;
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    studiedMin += studiedByDate.get(cursor) ?? 0;
    const day = dayByDate.get(cursor);
    if (day) plannedMin += dayLoad(day);
  }

  return {
    start,
    end,
    studiedMin: Math.round(studiedMin),
    plannedMin: Math.round(plannedMin),
    pct: plannedMin > 0 ? Math.round((studiedMin / plannedMin) * 100) : 0,
  };
}

export type FoldMetricKey = "streak" | "week" | "plan";

export type FoldMetric = {
  key: FoldMetricKey;
  /** Número grande do cartão. */
  value: string;
  /** Rótulo de 12px embaixo do número. */
  label: string;
  /** Nome acessível com o contexto completo (o cartão é um só bloco de texto). */
  ariaLabel: string;
};

/**
 * As três métricas da primeira dobra: sequência de dias, horas da semana
 * contra o planejado e percentual do plano concluído. O percentual vem do
 * termômetro (blocos concluídos / blocos planejados), para as duas seções
 * nunca divergirem.
 */
export function firstFoldMetrics(input: {
  days: PlanDay[];
  sessions: StudySession[];
  today: string;
}): FoldMetric[] {
  const { days, sessions, today } = input;
  const streak = currentStreak(days, sessions, today);
  const week = weekProgress(days, sessions, today);
  const plan = retaCoverage(days, sessions, today);
  const studied = formatHoursCompact(week.studiedMin);
  const planned = formatHoursCompact(week.plannedMin);

  return [
    {
      key: "streak",
      value: String(streak),
      label: streak === 1 ? "dia seguido" : "dias seguidos",
      ariaLabel: streak === 1 ? "Sequência de 1 dia" : `Sequência de ${streak} dias`,
    },
    {
      key: "week",
      value: studied,
      label: week.plannedMin > 0 ? `de ${planned} na semana` : "estudadas na semana",
      ariaLabel:
        week.plannedMin > 0
          ? `${studied} estudadas de ${planned} planejadas nesta semana`
          : `${studied} estudadas nesta semana, sem tempo planejado`,
    },
    {
      key: "plan",
      value: plan.planned > 0 ? `${plan.pct}%` : "—",
      label: "do plano concluído",
      ariaLabel:
        plan.planned > 0
          ? `${plan.pct}% do plano concluído`
          : "Plano sem blocos para medir a conclusão",
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Mapa de calor dos últimos 28 dias
 * ------------------------------------------------------------------ */

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Escala do mapa de calor por minutos estudados no dia:
 * 0 = nada, 1 = até 14, 2 = 15–29, 3 = 30–59, 4 = 60+.
 */
export function heatmapLevel(minutes: number): HeatmapLevel {
  const value = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  if (value <= 0) return 0;
  if (value < 15) return 1;
  if (value < 30) return 2;
  if (value < 60) return 3;
  return 4;
}

export type HeatmapCell = {
  date: string;
  /** `05/11`, usado no rótulo acessível. */
  label: string;
  /** "05/11: 30 min" — exatamente o formato pedido na especificação. */
  ariaLabel: string;
  minutes: number;
  level: HeatmapLevel;
  isToday: boolean;
  /** Dia marcado como livre no plano (não quebra a sequência). */
  rest: boolean;
};

export type HeatmapWeek = {
  /** Segunda-feira da semana (pode ser anterior à janela de 28 dias). */
  start: string;
  /** `29/10` — rótulo da linha. */
  label: string;
  /** Sempre 7 posições, segunda → domingo; `null` fora da janela. */
  cells: Array<HeatmapCell | null>;
};

export type Heatmap = {
  weeks: HeatmapWeek[];
  weekdayInitials: readonly string[];
  /** Maior valor diário da janela (para a legenda e testes). */
  maxMinutes: number;
  totalMinutes: number;
  windowDays: number;
};

/** Monta o mapa de calor alinhado por semana (segunda → domingo). */
export function buildHeatmap(input: {
  days: PlanDay[];
  sessions: StudySession[];
  today: string;
  windowDays?: number;
}): Heatmap {
  const summary = buildConsistency(input);
  const byWeek = new Map<string, Array<HeatmapCell | null>>();

  let maxMinutes = 0;
  let totalMinutes = 0;

  for (const cell of summary.cells) {
    const minutes = Math.max(0, Math.round(cell.studiedMin));
    const label = dayMonth(cell.date);
    const heat: HeatmapCell = {
      date: cell.date,
      label,
      ariaLabel: `${label}: ${minutes} min`,
      minutes,
      level: heatmapLevel(minutes),
      isToday: cell.isToday,
      rest: cell.state === "livre",
    };
    maxMinutes = Math.max(maxMinutes, minutes);
    totalMinutes += minutes;

    const start = weekStart(cell.date);
    const row = byWeek.get(start) ?? [null, null, null, null, null, null, null];
    row[(weekday(cell.date) + 6) % 7] = heat;
    byWeek.set(start, row);
  }

  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, cells]) => ({ start, label: dayMonth(start), cells }));

  return {
    weeks,
    weekdayInitials: WEEKDAY_INITIALS,
    maxMinutes,
    totalMinutes,
    windowDays: summary.windowDays,
  };
}

/* ------------------------------------------------------------------ *
 * Planejado × real por assunto
 * ------------------------------------------------------------------ */

export type PlanRealRow = {
  key: string;
  label: string;
  plannedMin: number;
  studiedMin: number;
  /** 0 a 100 para a largura da barra. */
  pct: number;
};

/**
 * Compara o tempo planejado e o realmente estudado por assunto do plano.
 *
 * O plano só guarda o texto do bloco, então o assunto é o início do conteúdo
 * (`planTopicLabel`). Sessões de blocos que saíram do plano entram pelo tipo
 * do bloco, para nenhum minuto estudado sumir da conta.
 */
export function planVsReal(input: {
  days: PlanDay[];
  sessions: StudySession[];
  limit?: number;
}): PlanRealRow[] {
  const limit = Math.max(1, Math.round(input.limit ?? 5));
  const labelByBlock = new Map<string, string>();
  const display = new Map<string, string>();
  const planned = new Map<string, number>();
  const studied = new Map<string, number>();

  for (const day of input.days) {
    for (const block of day.blocks) {
      if (block.plannedMin <= 0) continue;
      const label = planTopicLabel(block.content);
      const key = labelKey(label);
      if (!key) continue;
      labelByBlock.set(`${day.date}:${block.kind}`, label);
      display.set(key, display.get(key) ?? label);
      planned.set(key, (planned.get(key) ?? 0) + block.plannedMin);
    }
  }

  for (const session of input.sessions) {
    const seconds = Number.isFinite(session.elapsedSec) ? Math.max(0, session.elapsedSec) : 0;
    if (!(session.status === "done" || session.status === "active" || seconds >= 60)) continue;
    const label =
      labelByBlock.get(`${session.date}:${session.kind}`) ??
      KIND_LABEL[session.kind] ??
      "Bloco";
    const key = labelKey(label);
    if (!key) continue;
    display.set(key, display.get(key) ?? label);
    studied.set(key, (studied.get(key) ?? 0) + seconds / 60);
  }

  const keys = new Set([...planned.keys(), ...studied.keys()]);
  return [...keys]
    .map((key) => {
      const plannedMin = Math.round(planned.get(key) ?? 0);
      const studiedMin = Math.round(studied.get(key) ?? 0);
      return {
        key,
        label: display.get(key) ?? key,
        plannedMin,
        studiedMin,
        pct:
          plannedMin > 0
            ? Math.round((studiedMin / plannedMin) * 100)
            : studiedMin > 0
              ? 100
              : 0,
      };
    })
    .filter((row) => row.plannedMin > 0 || row.studiedMin > 0)
    .sort(
      (a, b) =>
        b.plannedMin - a.plannedMin ||
        b.studiedMin - a.studiedMin ||
        a.label.localeCompare(b.label),
    )
    .slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * Assuntos mais fracos e motivos dos erros
 * ------------------------------------------------------------------ */

export function weakTopics(input: {
  days: PlanDay[];
  sessions: StudySession[];
  mistakes: Mistake[];
  limit?: number;
}): WeakTopic[] {
  return weakTopicRanking({ ...input, limit: input.limit ?? 5 });
}

/** Motivos de erro com pelo menos um registro, do mais frequente ao menos. */
export function reasonRows(mistakes: Mistake[]): ErrorReasonRow[] {
  return errorReasonDistribution(mistakes)
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/* ------------------------------------------------------------------ *
 * Dias do plano (compacto) e estado vazio
 * ------------------------------------------------------------------ */

export type PlanDayState = "feito" | "parcial" | "falta" | "livre" | "vem";

export const PLAN_DAY_STATE_LABEL: Record<PlanDayState, string> = {
  feito: "feito",
  parcial: "parcial",
  falta: "falta",
  livre: "livre",
  vem: "vem",
};

export type PlanDayRow = {
  date: string;
  label: string;
  state: PlanDayState;
  stateLabel: string;
  isToday: boolean;
};

/** Uma linha curta por dia do plano, sem repetir os números das métricas. */
export function planDayRows(
  days: PlanDay[],
  sessions: StudySession[],
  today: string,
): PlanDayRow[] {
  const studiedByDate = sessionMinutesByDate(sessions);
  return days.map((day) => {
    const planned = dayLoad(day);
    const studied = studiedByDate.get(day.date) ?? 0;
    let state: PlanDayState;
    if (planned <= 0) state = "livre";
    else if (day.date > today) state = "vem";
    else if (studied >= Math.max(1, planned - 1)) state = "feito";
    else if (studied > 0) state = "parcial";
    else state = "falta";
    return {
      date: day.date,
      label: dayMonth(day.date),
      state,
      stateLabel: PLAN_DAY_STATE_LABEL[state],
      isToday: day.date === today,
    };
  });
}

export const EMPTY_PROGRESS_TITLE = "Seu progresso começa no primeiro bloco";
export const EMPTY_PROGRESS_MESSAGE = "Estude o primeiro bloco para ver seu progresso";

/** Estado vazio no mesmo formato do `ErrorState` (um único CTA preenchido). */
export function emptyProgressCopy(): ErrorCopy {
  return {
    kind: "empty",
    title: EMPTY_PROGRESS_TITLE,
    message: EMPTY_PROGRESS_MESSAGE,
    action: { id: "today-plan", label: "Ir para Hoje", href: "/" },
  };
}

export type ProgressCoverage = RetaCoverage;
