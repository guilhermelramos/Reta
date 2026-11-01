import { formatClock, timerElapsedMs, timerExpired, timerRemainingMs } from "./time.ts";
import type { SessionTimerState } from "./time.ts";

/**
 * Leitura do cronômetro para a barra fixa da sessão.
 *
 * Nada aqui conta segundos: o valor vem sempre do estado persistido
 * (`startedAt` + acumulado) e do relógio real, igual a `time.ts`. A UI usa
 * `setInterval` só para repintar.
 */
export type SessionTimerView = {
  elapsedMs: number;
  elapsedSec: number;
  remainingMs: number;
  /** Arredondado para cima: o relógio não mostra 00:00 antes da hora. */
  remainingSec: number;
  /** 0 a 1; bloco sem meta fica em 0. */
  progress: number;
  expired: boolean;
  /** Tempo estudado no formato MM:SS (ou H:MM:SS). */
  clock: string;
  /** Tempo restante no mesmo formato. */
  remainingClock: string;
  studiedMin: number;
  state: "paused" | "running" | "expired";
};

export function studiedMinutes(elapsedSec: number): number {
  const sec = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : 0;
  return Math.floor(sec / 60);
}

export function sessionTimerView(input: {
  budgetMin: number;
  timer: SessionTimerState;
  now: number;
}): SessionTimerView {
  const elapsedMs = timerElapsedMs(input.timer, input.now);
  const remainingMs = timerRemainingMs(input.budgetMin, elapsedMs);
  const expired = timerExpired(input.budgetMin, elapsedMs);
  const budgetMs = Math.max(0, input.budgetMin) * 60_000;
  const progress = budgetMs > 0 ? Math.min(1, Math.max(0, elapsedMs / budgetMs)) : 0;
  const elapsedSec = Math.floor(elapsedMs / 1000);

  return {
    elapsedMs,
    elapsedSec,
    remainingMs,
    remainingSec: Math.ceil(remainingMs / 1000),
    progress,
    expired,
    clock: formatClock(elapsedSec),
    remainingClock: formatClock(Math.ceil(remainingMs / 1000)),
    studiedMin: studiedMinutes(elapsedSec),
    state: expired ? "expired" : input.timer.startedAt != null ? "running" : "paused",
  };
}

/**
 * Título do diálogo de encerramento. Usa os minutos inteiros já estudados —
 * os mesmos que vão para o registro da sessão (`elapsedSec` é truncado).
 */
export function endDialogTitle(elapsedSec: number): string {
  const min = studiedMinutes(elapsedSec);
  return min > 0 ? `Encerrar e salvar ${min} min?` : "Encerrar e salvar menos de 1 min?";
}

/** Texto do snackbar de bloco concluído. Sempre mostra ao menos 1 min. */
export function completedSnackbarText(elapsedSec: number): string {
  const min = Math.max(1, studiedMinutes(elapsedSec));
  return `Bloco concluído · ${min} min`;
}
