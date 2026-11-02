/**
 * Leitura pura da tela Plano.
 *
 * A tela não guarda o plano: estas funções recebem os dias e as sessões já
 * carregados do IndexedDB e devolvem o cabeçalho, os grupos de semana, o
 * estado de cada dia e a contagem de atrasados. Assim a lista agrupada e o
 * aviso de "N dias atrasados" ficam testáveis sem navegador.
 */

import { rangeLabel } from "./import-preview.ts";
import { displaySheetName } from "./sheet-name.ts";
import { blockState, weekKey } from "./today.ts";
import type { PlanDay, StudySession } from "./types.ts";

export type PlanDayState = "feito" | "parcial" | "pendente" | "descanso";

export const PLAN_DAY_STATE_LABEL: Record<PlanDayState, string> = {
  feito: "Feito",
  parcial: "Parcial",
  pendente: "Pendente",
  descanso: "Descanso",
};

function orderedDays(days: readonly PlanDay[]): PlanDay[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

function blocksWithLoad(day: PlanDay) {
  return day.blocks.filter((block) => block.plannedMin > 0);
}

/**
 * Estado do dia inteiro.
 *
 * `descanso` quando nenhum bloco tem carga; `feito` quando todos os blocos
 * com carga estão concluídos; `parcial` quando pelo menos um foi concluído ou
 * está em andamento; `pendente` quando nenhum começou.
 */
export function planDayState(day: PlanDay, sessions: readonly StudySession[]): PlanDayState {
  const blocks = blocksWithLoad(day);
  if (!blocks.length) return "descanso";

  let done = 0;
  let started = 0;
  for (const block of blocks) {
    const state = blockState(sessions, day.date, block.kind);
    if (state === "done") done += 1;
    else if (state === "active") started += 1;
  }
  if (done === blocks.length) return "feito";
  return done > 0 || started > 0 ? "parcial" : "pendente";
}

/**
 * Um dia anterior a hoje com pelo menos um bloco de carga ainda não concluído.
 * Dias de descanso e dias futuros nunca contam como atrasados.
 */
export function isOverdueDay(
  day: PlanDay,
  sessions: readonly StudySession[],
  today: string,
): boolean {
  if (day.date >= today) return false;
  return blocksWithLoad(day).some((block) => blockState(sessions, day.date, block.kind) !== "done");
}

/** Dias atrasados, em ordem de data (o cartão de aviso mostra a contagem). */
export function overdueDays(
  days: readonly PlanDay[],
  sessions: readonly StudySession[],
  today: string,
): PlanDay[] {
  return orderedDays(days).filter((day) => isOverdueDay(day, sessions, today));
}

export function overdueDayCount(
  days: readonly PlanDay[],
  sessions: readonly StudySession[],
  today: string,
): number {
  return overdueDays(days, sessions, today).length;
}

/** "1 dia atrasado" / "3 dias atrasados". */
export function overdueLabel(count: number): string {
  const total = Math.max(0, Math.round(count));
  return `${total} ${total === 1 ? "dia atrasado" : "dias atrasados"}`;
}

export type PlanScrollTarget = "atrasados" | "hoje" | "nenhum";

/**
 * Para onde a tela Plano leva a rolagem ao abrir.
 *
 * Com dias atrasados, o aviso "N dias atrasados" (e o botão Recalcular) fica
 * no topo da lista e precisa continuar à vista: rolar até hoje o esconderia
 * atrás do cabeçalho. Sem atrasados, o alvo é a semana de hoje — e quando o
 * plano não tem esse dia, a tela fica onde está.
 */
export function planScrollTarget({
  days,
  today,
  overdueCount,
}: {
  days: readonly PlanDay[];
  today: string;
  overdueCount: number;
}): PlanScrollTarget {
  if (Math.max(0, Math.round(overdueCount)) > 0) return "atrasados";
  return days.some((day) => day.date === today) ? "hoje" : "nenhum";
}

export type PlanWeek = {
  /** Segunda-feira da semana (YYYY-MM-DD), usada como chave da seção. */
  start: string;
  /** "Semana de 27/10". */
  label: string;
  days: PlanDay[];
};

/**
 * Agrupa a lista por semana, mantendo os dias em ordem crescente. A chave é a
 * segunda-feira, a mesma de `weekKey` usada pela sugestão "Preparar semana".
 */
export function groupDaysByWeek(days: readonly PlanDay[]): PlanWeek[] {
  const groups = new Map<string, PlanDay[]>();
  for (const day of orderedDays(days)) {
    const start = weekKey(day.date);
    const group = groups.get(start);
    if (group) group.push(day);
    else groups.set(start, [day]);
  }
  return [...groups.entries()].map(([start, weekDays]) => ({
    start,
    label: `Semana de ${dayMonth(start)}`,
    days: weekDays,
  }));
}

/** `2026-11-02` → `02/11` (a chave já vem validada do parser/banco). */
export function dayMonth(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return month && day ? `${day}/${month}` : dateKey;
}

/**
 * Linha do topo: "Planilha: Nome · 04/03 a 30/06 · 12 dias".
 * O plano de exemplo não tem nome gravado; nesse caso usamos um rótulo
 * neutro em vez de mostrar "Planilha: ·".
 */
export function planHeaderLine({
  days,
  sheetName,
}: {
  days: readonly PlanDay[];
  sheetName?: string;
}): string {
  const name = displaySheetName(sheetName) || "Plano de exemplo";
  const ordered = orderedDays(days);
  if (!ordered.length) return `Planilha: ${name} · nenhum dia`;
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const count = ordered.length;
  return `Planilha: ${name} · ${rangeLabel(first.date, last.date)} · ${count} ${
    count === 1 ? "dia" : "dias"
  }`;
}

/**
 * Duas linhas da lista: a fase (ou o primeiro assunto) e os demais assuntos.
 * Dia sem fase e com um assunto só devolve `detail` vazio para a linha não
 * repetir o mesmo texto.
 */
export function planDayTopics(day: PlanDay): { title: string; detail: string } {
  const topics = blocksWithLoad(day)
    .map((block) => block.content.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const phase = day.phase.replace(/\s+/g, " ").trim();
  if (phase) {
    return { title: phase, detail: topics.join(" · ") };
  }
  const [first = "Dia sem blocos", ...rest] = topics;
  return { title: first, detail: rest.join(" · ") };
}
