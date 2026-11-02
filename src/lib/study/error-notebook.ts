import { easyIntervalDays, isDueToday, isMastered, type SrsOutcome } from "./srs.ts";
import { daysBetween, formatShortDate } from "./time.ts";
import { ERROR_REASON_LABEL, KIND_LABEL, MISTAKE_SOURCE_LABEL } from "./types.ts";
import type { ErrorReason, Mistake } from "./types.ts";

/**
 * Leitura pura do caderno de erros (tela `/erros`).
 *
 * A tela não recalcula contagens, filtros ou a ordem dentro do JSX: tudo vem
 * daqui para poder ser testado no Node sem navegador. As datas entram por
 * parâmetro (`today` em YYYY-MM-DD), como em `srs.ts`/`today.ts`.
 */

/** Status escolhido nos chips. `pendentes` inclui os vencidos. */
export type NotebookStatus = "vencidos" | "pendentes" | "dominados";

export type NotebookFilters = {
  /** Matéria/assunto exato; `null` = todas. */
  subject: string | null;
  reason: ErrorReason | null;
  status: NotebookStatus;
};

export type NotebookCounts = {
  due: number;
  pending: number;
  mastered: number;
  total: number;
};

export const NOTEBOOK_STATUSES: readonly NotebookStatus[] = ["vencidos", "pendentes", "dominados"];

export const NOTEBOOK_STATUS_LABEL: Record<NotebookStatus, string> = {
  vencidos: "Para revisar",
  pendentes: "Pendentes",
  dominados: "Dominados",
};

/** Status inicial: todos os pendentes, com os vencidos no topo da lista. */
export const DEFAULT_NOTEBOOK_FILTERS: NotebookFilters = {
  subject: null,
  reason: null,
  status: "pendentes",
};

/** Rótulos curtos dos botões de resultado (o texto completo fica no aria). */
export const SRS_OUTCOME_SHORT_LABEL: Record<SrsOutcome, string> = {
  errei: "Errei",
  dificil: "Difícil",
  facil: "Fácil",
};

export const EMPTY_MISTAKE_PROMPT = "Escreva o resumo da questão ou da dúvida.";

export const DELETE_MISTAKE_TITLE = "Excluir este erro?";
export const DELETE_MISTAKE_BODY =
  "Ele sai do caderno e da repetição espaçada. Não dá para desfazer.";

/** Origem curta mostrada no detalhe e na revisão. */
export function mistakeSourceLabel(
  mistake: Pick<Mistake, "source" | "subject" | "kind">,
  includeSubject = true,
): string {
  if (mistake.source === "externo") {
    const subject = includeSubject ? mistake.subject?.trim() : "";
    return subject ? `${MISTAKE_SOURCE_LABEL.externo} · ${subject}` : MISTAKE_SOURCE_LABEL.externo;
  }
  return KIND_LABEL[mistake.kind];
}

/**
 * Matéria/assunto mostrado no título do cartão. Erros de sessão não guardam a
 * matéria: usam o tópico do bloco (ex.: "Funções afim"). Erros externos podem
 * ter "Matéria · Tópico"; o chip usa só a primeira parte.
 */
export function mistakeSubject(mistake: Pick<Mistake, "subject" | "topic">): string {
  const subject = mistake.subject?.trim();
  if (subject) return subject;
  const topic = (mistake.topic ?? "").trim();
  if (!topic) return "Sem matéria";
  const head = topic.split(" · ")[0]?.trim();
  return head || "Sem matéria";
}

/**
 * Resto do tópico que não repete a matéria já usada no título do detalhe.
 * "Biologia · Genética" com matéria "Biologia" vira "Genética"; um tópico igual
 * ao título vira string vazia (nada repetido na folha).
 */
export function mistakeSubtopic(mistake: Pick<Mistake, "subject" | "topic">): string {
  const topic = (mistake.topic ?? "").trim();
  if (!topic) return "";
  const subject = mistake.subject?.trim();
  if (subject && topic.startsWith(subject)) {
    return topic
      .slice(subject.length)
      .replace(/^\s*·\s*/, "")
      .trim();
  }
  return topic === mistakeSubject(mistake) ? "" : topic;
}

/** Conta vencidos, pendentes, dominados e o total do caderno. */
export function notebookCounts(mistakes: readonly Mistake[], today: string): NotebookCounts {
  let due = 0;
  let pending = 0;
  let mastered = 0;
  for (const mistake of mistakes) {
    if (isMastered(mistake)) {
      mastered += 1;
      continue;
    }
    pending += 1;
    if (isDueToday(mistake, today)) due += 1;
  }
  return { due, pending, mastered, total: mistakes.length };
}

/** Linha do topo: "N para revisar hoje · M no total". */
export function notebookSummary(counts: NotebookCounts): string {
  return `${counts.due} para revisar hoje · ${counts.total} no total`;
}

/** Próxima data de revisão futura entre os erros ainda não dominados. */
export function nextReviewDate(mistakes: readonly Mistake[], today: string): string | null {
  let next: string | null = null;
  for (const mistake of mistakes) {
    if (isMastered(mistake)) continue;
    const date = mistake.nextReviewAt;
    if (!date || date <= today) continue;
    if (!next || date < next) next = date;
  }
  return next;
}

/** "Próxima revisão amanhã" / "Próxima revisão em 05/11"; vazio sem data. */
export function nextReviewLabel(date: string | null, today: string): string {
  if (!date) return "";
  if (daysBetween(today, date) <= 1) return "Próxima revisão amanhã";
  return `Próxima revisão em ${formatShortDate(date)}`;
}

function matchesStatus(mistake: Mistake, status: NotebookStatus, today: string): boolean {
  if (status === "dominados") return isMastered(mistake);
  if (status === "vencidos") return isDueToday(mistake, today);
  return !isMastered(mistake);
}

/** Aplica status + matéria + motivo, sem alterar a lista recebida. */
export function filterMistakes(
  mistakes: readonly Mistake[],
  filters: NotebookFilters,
  today: string,
): Mistake[] {
  return mistakes.filter((mistake) => {
    if (!matchesStatus(mistake, filters.status, today)) return false;
    if (filters.subject && mistakeSubject(mistake) !== filters.subject) return false;
    if (filters.reason && mistake.errorReason !== filters.reason) return false;
    return true;
  });
}

/** Mais perto de vencer primeiro; empate pelo mais recente. */
export function sortMistakes(mistakes: readonly Mistake[]): Mistake[] {
  return [...mistakes].sort(
    (a, b) =>
      (a.nextReviewAt ?? "").localeCompare(b.nextReviewAt ?? "") || b.createdAt - a.createdAt,
  );
}

/** Lista final da tela: filtros aplicados e ordem de revisão. */
export function notebookList(
  mistakes: readonly Mistake[],
  filters: NotebookFilters,
  today: string,
): Mistake[] {
  return sortMistakes(filterMistakes(mistakes, filters, today));
}

/** Matérias presentes no caderno, em ordem alfabética (pt-BR). */
export function notebookSubjects(mistakes: readonly Mistake[]): string[] {
  return [...new Set(mistakes.map(mistakeSubject))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Motivos presentes no caderno, na ordem fixa dos chips. */
export function notebookReasons(mistakes: readonly Mistake[]): ErrorReason[] {
  return (Object.keys(ERROR_REASON_LABEL) as ErrorReason[]).filter((reason) =>
    mistakes.some((mistake) => mistake.errorReason === reason),
  );
}

/** Há algum filtro diferente do padrão? (mostra o chip "Limpar") */
export function hasActiveFilters(filters: NotebookFilters): boolean {
  return (
    filters.subject !== null ||
    filters.reason !== null ||
    filters.status !== DEFAULT_NOTEBOOK_FILTERS.status
  );
}

/** Volta aos filtros padrão sem compartilhar o objeto constante. */
export function clearNotebookFilters(): NotebookFilters {
  return { ...DEFAULT_NOTEBOOK_FILTERS };
}

/** Data/estado da próxima revisão no cartão compacto. */
export function nextReviewCardLabel(
  mistake: Pick<Mistake, "nextReviewAt" | "reviewed" | "srsStage">,
  today: string,
): string {
  if (isMastered(mistake)) return "Dominado";
  if (!mistake.nextReviewAt || mistake.nextReviewAt <= today) return "Revisar hoje";
  return `Próxima revisão ${formatShortDate(mistake.nextReviewAt)}`;
}

/** Rótulo "k de N" da revisão em andamento. */
export function reviewProgressLabel(index: number, total: number): string {
  const size = Math.max(0, total);
  if (!size) return "0 de 0";
  const current = Math.min(size, Math.max(1, Math.floor(index) + 1));
  return `${current} de ${size}`;
}

/** Percentual da barra de progresso (0–100). */
export function reviewProgressPercent(index: number, total: number): number {
  const size = Math.max(0, total);
  if (!size) return 0;
  const current = Math.min(size, Math.max(1, Math.floor(index) + 1));
  return Math.round((current / size) * 100);
}

/** Intervalo mostrado abaixo do resultado (+1 dia, +3 dias, +7/15/30 dias). */
export function outcomeIntervalLabel(outcome: SrsOutcome, stage?: number): string {
  if (outcome === "errei") return "+1 dia";
  if (outcome === "dificil") return "+3 dias";
  return `+${easyIntervalDays(stage ?? 0)} dias`;
}

/** Texto do estado vazio da lista, sem repetir a frase do cartão herói. */
export function emptyListMessage(status: NotebookStatus, filtered: boolean): string {
  if (filtered) return "Nenhum erro com estes filtros.";
  if (status === "dominados") {
    return "Nenhum erro dominado ainda. Use “Dominado / Fácil” na revisão.";
  }
  if (status === "pendentes") return "Nenhum erro pendente.";
  return "Os próximos erros aparecem aqui na data da revisão.";
}

/** Validação do formulário: só o resumo da questão é obrigatório. */
export function validateMistakePrompt(prompt: string): string | null {
  return prompt.trim() ? null : EMPTY_MISTAKE_PROMPT;
}
