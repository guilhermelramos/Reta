import { addDays } from "./time.ts";
import type {
  BlockKind,
  Difficulty,
  PlanBlock,
  PlanDay,
  QuizItem,
  SessionFlow,
  StudySession,
  Subtopic,
} from "./types.ts";

const ORDER: Difficulty[] = ["facil", "medio", "dificil"];

export function emptyFlow(): SessionFlow {
  return { sub: 0, phase: "diag", q: 0, practiceAsked: [], practiceLevel: "facil", diagMiss: false, checks: {} };
}

export function bumpLevel(level: Difficulty, up: boolean): Difficulty {
  const index = ORDER.indexOf(level);
  return ORDER[Math.min(2, Math.max(0, index + (up ? 1 : -1)))] ?? level;
}

export function pickPractice(sub: Subtopic, flow: SessionFlow): QuizItem | null {
  const used = new Set(flow.practiceAsked);
  const pool = sub.practice.filter((item) => !used.has(item.id));
  return pool.find((item) => item.difficulty === flow.practiceLevel) ?? pool[0] ?? null;
}

export function questionFor(sub: Subtopic, flow: SessionFlow): QuizItem | null {
  if (flow.phase === "diag") return sub.diagnostic[flow.q] ?? null;
  if (flow.phase === "pratica") return pickPractice(sub, flow);
  if (flow.phase === "checagem") return sub.mastery;
  return null;
}

/* ------------------------------------------------------------------ *
 * Recalcular a Reta (reagendamento de atrasos)
 *
 * Função pura: recebe o plano de hoje e devolve um plano novo (sem tocar no
 * array original) mais um resumo do que mudou. A UI mostra o resumo e só
 * grava depois que o usuário confirma.
 * ------------------------------------------------------------------ */

/** Como o bloco atrasado foi encaixado na reta. */
export type ScheduleMoveMode = "bloco-b" | "revisao" | "fila";

export type ScheduleMove = {
  fromDate: string;
  fromKind: BlockKind;
  content: string;
  minutes: number;
  toDate: string;
  toKind: BlockKind;
  mode: ScheduleMoveMode;
};

export type RecalculateSummary = {
  /** Blocos de datas passadas que não foram concluídos. */
  overdue: number;
  /** Blocos efetivamente reagendados. */
  moved: number;
  /** Atrasados que já tinham sido reagendados antes (não duplicam). */
  skipped: number;
  minutes: number;
  /** Quantos dias da reta recebem conteúdo novo. */
  daysTouched: number;
  /** Último dia que recebeu conteúdo (a reta pode esticar além do plano original). */
  lastDate: string | null;
  byMode: Record<ScheduleMoveMode, number>;
};

export type RecalculateResult = {
  days: PlanDay[];
  moves: ScheduleMove[];
  summary: RecalculateSummary;
};

const KIND_ORDER: BlockKind[] = ["A", "B", "R", "L"];

type OverdueBlock = {
  fromDate: string;
  fromKind: BlockKind;
  content: string;
  plannedMin: number;
  /** Chave de origem estável (`YYYY-MM-DD:Bloco`) para evitar duplicatas. */
  marker: string;
};

function cloneDay(day: PlanDay): PlanDay {
  return { ...day, blocks: day.blocks.map((block) => ({ ...block })) };
}

function sortBlocks(day: PlanDay): void {
  day.blocks.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

function isOccupied(day: PlanDay, kind: BlockKind): boolean {
  const block = day.blocks.find((item) => item.kind === kind);
  return Boolean(block && block.plannedMin > 0 && block.content.trim());
}

function hasFreeSlot(day: PlanDay, kind: BlockKind): boolean {
  return !isOccupied(day, kind);
}

function setBlock(day: PlanDay, kind: BlockKind, content: string, plannedMin: number, marker?: string): void {
  const index = day.blocks.findIndex((block) => block.kind === kind);
  const block: PlanBlock = { kind, content, plannedMin };
  if (marker) block.rescheduledFrom = marker;
  if (index >= 0) day.blocks[index] = block;
  else day.blocks.push(block);
  sortBlocks(day);
}

function clearBlock(day: PlanDay, kind: BlockKind): void {
  day.blocks = day.blocks.filter((block) => block.kind !== kind);
}

function movableBlocks(day: PlanDay): PlanBlock[] {
  return day.blocks.filter((block) => block.plannedMin > 0 && block.content.trim().length > 0);
}

function isReviewDay(day: PlanDay): boolean {
  if (/revis/i.test(day.phase ?? "")) return true;
  return day.blocks.some((block) => block.kind === "R" && block.plannedMin > 0 && /revis/i.test(block.content));
}

/** Dias de descanso, prova ou simulado não recebem atrasados nem entram na fila. */
function isProtectedDay(day: PlanDay): boolean {
  return /descanso|folga|livre|prova|simulado/i.test(day.phase ?? "");
}

/** Dia pode receber o bloco: não é dia protegido e a janela do tipo está vazia. */
function canReceive(day: PlanDay, kind: BlockKind): boolean {
  return !isProtectedDay(day) && hasFreeSlot(day, kind);
}

/**
 * Reagenda os blocos de datas passadas que não foram concluídos.
 *
 * Estratégia, nesta ordem:
 * 1. preenche janelas de Bloco B vazias nos dias futuros;
 * 2. usa janelas de Revisão livres em dias marcados como revisão;
 * 3. encaixa em qualquer janela livre do mesmo tipo ou empurra a fila de
 *    dias futuros ainda não iniciados (criando dias no fim quando preciso).
 *
 * `sessions` é opcional: sem ele, todo bloco com tempo no passado conta como
 * atrasado. Com ele, blocos com sessão concluída ficam de fora.
 */
export function recalculateSchedule(
  days: PlanDay[],
  todayDate: string,
  sessions: StudySession[] = [],
): RecalculateResult {
  const work = days.map(cloneDay).sort((a, b) => a.date.localeCompare(b.date));
  const future = work.filter((day) => day.date >= todayDate);
  const finished = new Set(sessions.filter((s) => s.status === "done").map((s) => `${s.date}:${s.kind}`));
  const started = new Set(sessions.map((s) => s.date));

  // Chaves já reagendadas antes: não copiar o mesmo atraso de novo.
  const alreadyMoved = new Set<string>();
  for (const day of work) {
    for (const block of day.blocks) {
      if (block.rescheduledFrom) alreadyMoved.add(block.rescheduledFrom);
    }
  }

  const overdue: OverdueBlock[] = [];
  let skipped = 0;
  for (const day of work) {
    if (day.date >= todayDate) continue;
    for (const block of day.blocks) {
      if (block.plannedMin <= 0 || !block.content.trim()) continue;
      const key = `${day.date}:${block.kind}`;
      if (finished.has(key)) continue;
      if (alreadyMoved.has(key)) {
        skipped += 1;
        continue;
      }
      overdue.push({
        fromDate: day.date,
        fromKind: block.kind,
        content: block.content,
        plannedMin: block.plannedMin,
        marker: block.rescheduledFrom ?? key,
      });
    }
  }

  const moves: ScheduleMove[] = [];
  const byMode: Record<ScheduleMoveMode, number> = { "bloco-b": 0, revisao: 0, fila: 0 };
  /** Dias que já receberam conteúdo nesta rodada (não viram fonte da fila). */
  const locked = new Set<string>();
  /** Dias alterados (receberam atrasado ou conteúdo empurrado). */
  const touched = new Set<string>();
  let horizon = work.length ? (work[work.length - 1]?.date ?? todayDate) : todayDate;

  function ensureDayAfter(afterDate: string): PlanDay {
    const base = afterDate > horizon ? afterDate : horizon;
    // Nunca cria um dia "novo" no passado: o piso é o próprio hoje.
    const date = addDays(base < todayDate ? todayDate : base, 1);
    horizon = date;
    const day: PlanDay = { date, phase: "Continuação", blocks: [] };
    work.push(day);
    future.push(day);
    work.sort((a, b) => a.date.localeCompare(b.date));
    future.sort((a, b) => a.date.localeCompare(b.date));
    return day;
  }

  function place(item: OverdueBlock, day: PlanDay, kind: BlockKind, mode: ScheduleMoveMode): void {
    setBlock(day, kind, item.content, item.plannedMin, item.marker);
    locked.add(day.date);
    touched.add(day.date);
    moves.push({
      fromDate: item.fromDate,
      fromKind: item.fromKind,
      content: item.content,
      minutes: item.plannedMin,
      toDate: day.date,
      toKind: kind,
      mode,
    });
    byMode[mode] += 1;
  }

  /** Destino mais adiante para um bloco empurrado pela fila. */
  function findForwardTarget(kind: BlockKind, afterDate: string, reserved: Set<string>): PlanDay {
    const candidates = future.filter(
      (day) =>
        day.date > afterDate &&
        !locked.has(day.date) &&
        canReceive(day, kind) &&
        !reserved.has(`${day.date}:${kind}`),
    );
    const emptyDay = candidates.find((day) => movableBlocks(day).length === 0);
    if (emptyDay) return emptyDay;
    if (candidates.length) return candidates[0] as PlanDay;
    // Sem espaço adiante: abre um dia novo no fim da reta.
    return ensureDayAfter(afterDate);
  }

  /**
   * Empurra o conteúdo de um dia futuro não iniciado para os dias seguintes,
   * liberando o dia para receber o bloco atrasado.
   */
  function pushDayForward(source: PlanDay): boolean {
    const movable = movableBlocks(source);
    if (!movable.length) return false;
    const reserved = new Set<string>();
    const planned: { block: PlanBlock; target: PlanDay }[] = [];
    for (const block of movable) {
      const target = findForwardTarget(block.kind, source.date, reserved);
      reserved.add(`${target.date}:${block.kind}`);
      planned.push({ block, target });
    }
    for (const { block, target } of planned) {
      setBlock(target, block.kind, block.content, block.plannedMin, block.rescheduledFrom);
      locked.add(target.date);
      touched.add(target.date);
    }
    for (const block of movable) clearBlock(source, block.kind);
    return true;
  }

  const pending = [...overdue];

  // 1) Janelas de Bloco B vazias (o encaixe mais barato).
  for (const item of [...pending]) {
    const target = future.find((day) => !locked.has(day.date) && canReceive(day, "B"));
    if (!target) continue;
    place(item, target, "B", "bloco-b");
    pending.splice(pending.indexOf(item), 1);
  }

  // 2) Dias de revisão com a janela de Revisão livre.
  for (const item of [...pending]) {
    const target = future.find(
      (day) => !locked.has(day.date) && !isProtectedDay(day) && isReviewDay(day) && canReceive(day, "R"),
    );
    if (!target) continue;
    place(item, target, "R", "revisao");
    pending.splice(pending.indexOf(item), 1);
  }

  // 3) Fila: janela livre do mesmo tipo ou empurra um dia não iniciado.
  for (const item of pending) {
    // Janela livre (mesmo em dia que já recebeu outro atrasado) não é fonte
    // da fila, então pode ser preenchida sem empurrar mais nada.
    const direct = future.find((day) => canReceive(day, item.fromKind));
    if (direct) {
      place(item, direct, item.fromKind, "fila");
      continue;
    }
    const source = future.find(
      (day) =>
        !locked.has(day.date) &&
        !isProtectedDay(day) &&
        !started.has(day.date) &&
        movableBlocks(day).length > 0,
    );
    if (source && pushDayForward(source)) {
      place(item, source, item.fromKind, "fila");
      continue;
    }
    place(item, ensureDayAfter(item.fromDate), item.fromKind, "fila");
  }

  const touchedDates = [...touched].sort((a, b) => a.localeCompare(b));
  const summary: RecalculateSummary = {
    overdue: overdue.length,
    moved: moves.length,
    skipped,
    minutes: moves.reduce((total, move) => total + move.minutes, 0),
    daysTouched: touchedDates.length,
    lastDate: touchedDates.length ? (touchedDates[touchedDates.length - 1] as string) : null,
    byMode,
  };

  return {
    days: work.map((day) => ({ ...day, blocks: day.blocks.map((block) => ({ ...block })) })),
    moves,
    summary,
  };
}
