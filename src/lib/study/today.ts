import { addDays } from "./time.ts";
import type { BlockKind, PlanBlock, StudySession } from "./types.ts";
import { KIND_LABEL } from "./types.ts";

/**
 * Leitura pura da tela Hoje.
 *
 * A tela não guarda estado de plano/sessão: estas funções recebem o dia e as
 * sessões já carregados do IndexedDB e devolvem o que mostrar, para a escolha
 * da próxima ação, o agrupamento dos blocos vazios e a dispensa semanal do
 * "Preparar semana" poderem ser testadas sem navegador.
 */

export type BlockState = "idle" | "active" | "done";

/** Estado de um bloco no dia: em andamento vence concluído, que vence pendente. */
export function blockState(
  sessions: readonly StudySession[],
  date: string,
  kind: BlockKind,
): BlockState {
  let done = false;
  for (const session of sessions) {
    if (session.date !== date || session.kind !== kind) continue;
    if (session.status === "active") return "active";
    if (session.status === "done") done = true;
  }
  return done ? "done" : "idle";
}

/** Minutos realmente estudados no bloco (soma das sessões do dia). */
export function studiedMinutesFor(
  sessions: readonly StudySession[],
  date: string,
  kind: BlockKind,
): number {
  const seconds = sessions.reduce((sum, session) => {
    if (session.date !== date || session.kind !== kind) return sum;
    const elapsed = Number.isFinite(session.elapsedSec) ? Math.max(0, session.elapsedSec) : 0;
    return sum + elapsed;
  }, 0);
  return Math.round(seconds / 60);
}

/** Blocos que ainda têm carga no dia (planejado > 0). */
export function loadBlocks(blocks: readonly PlanBlock[]): PlanBlock[] {
  return blocks.filter((block) => block.plannedMin > 0);
}

export type NextAction = {
  block: PlanBlock;
  state: "idle" | "active";
};

/**
 * Próxima ação do dia.
 *
 * Um timer em andamento tem prioridade (o botão vira "Continuar"); senão vale
 * o primeiro bloco com carga ainda não concluído. Dia sem carga ou com tudo
 * concluído devolve `null` — a tela mostra o cartão de descanso/conclusão.
 */
export function nextAction(
  blocks: readonly PlanBlock[],
  sessions: readonly StudySession[],
  date: string,
): NextAction | null {
  const withLoad = loadBlocks(blocks).map((block) => ({
    block,
    state: blockState(sessions, date, block.kind),
  }));

  const active = withLoad.find((item) => item.state === "active");
  if (active) return { block: active.block, state: "active" };

  const pending = withLoad.find((item) => item.state === "idle");
  return pending ? { block: pending.block, state: "idle" } : null;
}

/**
 * Atalho "Só 15 min" do cartão herói.
 *
 * Só faz sentido para um bloco ainda não iniciado com carga suficiente para
 * valer a pena encurtar. Num bloco em andamento o timer já existe ("Continuar")
 * e um atalho de 15 min criaria dúvida sobre sobrescrever o tempo atual; nos
 * cartões da lista o botão repetido só atrapalha a leitura.
 */
export function showsShortSession(state: BlockState, plannedMin: number): boolean {
  return state === "idle" && Number.isFinite(plannedMin) && plannedMin >= 30;
}

/**
 * Tolerância do aviso de bloco pendente, igual à do Ajuste
 * "Aviso se o bloco ainda não começou" (45 min após o horário de estudo).
 */
export const LATE_GRACE_MIN = 45;

/**
 * O bloco pendente já passou do horário de estudo configurado?
 *
 * A tela usa isso para trocar o chip "Pendente" por "Atrasado" no próprio
 * cartão, no lugar do antigo banner entre o herói e a lista. Sem horário
 * válido na store a função devolve `false` (nada é sinalizado).
 */
export function isLatePending(
  state: BlockState,
  nowMin: number,
  studyMin: number,
  graceMin = LATE_GRACE_MIN,
): boolean {
  if (state !== "idle") return false;
  if (!Number.isFinite(nowMin) || !Number.isFinite(studyMin) || !Number.isFinite(graceMin)) {
    return false;
  }
  return nowMin >= studyMin + graceMin;
}

/**
 * Junta os blocos sem carga numa linha só, na ordem do plano:
 * "Bloco B, Revisão e Leitura: sem carga hoje".
 */
export function emptyBlocksLine(blocks: readonly PlanBlock[]): string | null {
  const labels = blocks
    .filter((block) => !(block.plannedMin > 0))
    .map((block) => KIND_LABEL[block.kind]);
  if (!labels.length) return null;
  if (labels.length === 1) return `${labels[0]}: sem carga hoje`;
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}: sem carga hoje`;
}

/**
 * Segunda-feira da semana de `dateKey` (YYYY-MM-DD).
 *
 * A dispensa do "Preparar semana" é gravada nessa chave: na semana seguinte a
 * data muda e a sugestão volta sozinha.
 */
export function weekKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return dateKey;
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addDays(dateKey, -mondayOffset);
}

/** A sugestão já foi dispensada nesta mesma semana? */
export function isPrepDismissed(dismissedWeek: string, today: string): boolean {
  if (!dismissedWeek) return false;
  return dismissedWeek === weekKey(today);
}

/**
 * O cartão "Preparar semana" aparece quando ainda não foi dispensado na
 * semana. Enquanto a preparação corre ele continua visível, mesmo dispensado,
 * para o progresso e o botão "Parar" não sumirem da tela.
 */
export function prepSuggestionVisible(input: {
  dismissedWeek: string;
  today: string;
  running: boolean;
}): boolean {
  if (input.running) return true;
  return !isPrepDismissed(input.dismissedWeek, input.today);
}
