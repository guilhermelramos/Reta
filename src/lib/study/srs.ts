import { addDays, daysBetween, formatShortDate } from "./time.ts";
import type { Mistake } from "./types.ts";

/** Quantos passos de retenção o caderno guarda antes de considerar dominado. */
export const SRS_MAX_STAGE = 5;

/** Retenção escolhida ao revisar um erro. */
export type SrsOutcome = "errei" | "dificil" | "facil";

export const SRS_OUTCOME_LABEL: Record<SrsOutcome, string> = {
  errei: "Errei de novo",
  dificil: "Acertei com dificuldade",
  facil: "Dominado / Fácil",
};

export function clampStage(raw?: number | null): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(SRS_MAX_STAGE, Math.max(0, Math.round(raw)));
}

/**
 * Erros antigos não têm `srsStage`; quem já estava marcado como revisto
 * entra como dominado, o resto começa no zero (vencido hoje).
 */
export function mistakeStage(mistake: Pick<Mistake, "srsStage" | "reviewed">): number {
  if (typeof mistake.srsStage === "number") return clampStage(mistake.srsStage);
  return mistake.reviewed ? SRS_MAX_STAGE : 0;
}

export function isMastered(mistake: Pick<Mistake, "srsStage" | "reviewed">): boolean {
  return Boolean(mistake.reviewed) || mistakeStage(mistake) >= SRS_MAX_STAGE;
}

/** Sem `nextReviewAt` (registro antigo) o erro está vencido agora. */
export function isDueToday(mistake: Mistake, today: string): boolean {
  if (isMastered(mistake)) return false;
  return !mistake.nextReviewAt || mistake.nextReviewAt <= today;
}

/** Dias até a próxima revisão; 0 significa hoje ou atrasado. */
export function daysUntilReview(mistake: Mistake, today: string): number {
  if (!mistake.nextReviewAt) return 0;
  return Math.max(0, daysBetween(today, mistake.nextReviewAt));
}

/** Intervalo do "Dominado / Fácil": +7, +15 ou +30 dias conforme o estágio. */
export function easyIntervalDays(stage: number): number {
  const current = clampStage(stage);
  if (current <= 1) return 7;
  if (current <= 3) return 15;
  return 30;
}

/** Resumo curto para a lista do caderno. */
export function reviewStatusLabel(mistake: Mistake, today: string): string {
  if (isMastered(mistake)) return "Dominado";
  if (!mistake.nextReviewAt) return "Revisar hoje";
  if (mistake.nextReviewAt <= today) return "Revisar hoje";
  const days = daysUntilReview(mistake, today);
  return days === 1 ? "Revisar amanhã" : `Revisar em ${days} dias`;
}

export function reviewDateLabel(mistake: Mistake): string {
  return mistake.nextReviewAt ? formatShortDate(mistake.nextReviewAt) : "hoje";
}

/**
 * Aplica o resultado de uma revisão e devolve o próximo estado do erro.
 * Função pura: `today` no formato YYYY-MM-DD entra por parâmetro.
 */
export function scheduleReview(mistake: Mistake, outcome: SrsOutcome, today: string): Mistake {
  const currentStage = mistakeStage(mistake);
  const reviewCount = (mistake.reviewCount ?? 0) + 1;

  if (outcome === "errei") {
    return {
      ...mistake,
      reviewed: false,
      srsStage: 0,
      nextReviewAt: addDays(today, 1),
      lastReviewedAt: today,
      reviewCount,
    };
  }

  if (outcome === "dificil") {
    const nextStage = Math.min(SRS_MAX_STAGE, currentStage + 1);
    return {
      ...mistake,
      reviewed: nextStage >= SRS_MAX_STAGE,
      srsStage: nextStage,
      nextReviewAt: addDays(today, 3),
      lastReviewedAt: today,
      reviewCount,
    };
  }

  const nextStage = Math.min(SRS_MAX_STAGE, currentStage + 1);
  return {
    ...mistake,
    reviewed: nextStage >= SRS_MAX_STAGE,
    srsStage: nextStage,
    nextReviewAt: addDays(today, easyIntervalDays(currentStage)),
    lastReviewedAt: today,
    reviewCount,
  };
}

/** Campos padrão para um erro novo: já nasce agendado para hoje. */
export function newMistakeSrs(
  today: string,
): Pick<Mistake, "srsStage" | "nextReviewAt" | "reviewCount" | "reviewed"> {
  return { srsStage: 0, nextReviewAt: today, reviewCount: 0, reviewed: false };
}
