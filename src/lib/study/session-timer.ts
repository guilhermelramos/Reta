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
  /** Número principal da tela e do chip do professor: restante ou "+MM:SS". */
  headline: string;
  headlineState: TimerHeadlineState;
  /** Quanto passou da meta (ms); zero enquanto ainda falta tempo. */
  overtimeMs: number;
  /** "N min estudado(s) de M min" da sub-linha. */
  subline: string;
  /** Variante curta da coluna esquerda em paisagem: "N de M min estudados". */
  landscapeSubline: string;
  studiedMin: number;
  state: "paused" | "running" | "expired";
};

export type TimerHeadlineState = "countdown" | "overtime" | "elapsed";

export type TimerHeadline = {
  /** "23:14" (restante), "+01:20" (além da meta) ou decorrido sem meta. */
  label: string;
  state: TimerHeadlineState;
  overtimeMs: number;
};

export function studiedMinutes(elapsedSec: number): number {
  const sec = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : 0;
  return Math.floor(sec / 60);
}

/**
 * Número principal único do timer — o cabeçalho da sessão e o chip da folha do
 * Professor chamam esta função, então nunca divergem.
 *
 * Antes da meta: contagem regressiva (`MM:SS`). Depois: `+MM:SS` do estouro.
 * No instante exato da meta continua `00:00` (sem "+"). Bloco sem meta
 * (`budgetMin <= 0`) mostra o tempo decorrido, porque não há o que contar.
 */
export function timerHeadline(input: {
  budgetMin: number;
  elapsedMs: number;
  elapsedSec: number;
  remainingSec: number;
}): TimerHeadline {
  const budget = Number.isFinite(input.budgetMin) ? Math.max(0, input.budgetMin) : 0;
  const elapsedSec = Number.isFinite(input.elapsedSec) ? Math.max(0, input.elapsedSec) : 0;

  if (budget <= 0) {
    return { label: formatClock(elapsedSec), state: "elapsed", overtimeMs: 0 };
  }

  const elapsedMs = Number.isFinite(input.elapsedMs) ? Math.max(0, input.elapsedMs) : 0;
  const overtimeMs = Math.max(0, elapsedMs - budget * 60_000);
  if (overtimeMs > 0) {
    return {
      label: `+${formatClock(Math.ceil(overtimeMs / 1000))}`,
      state: "overtime",
      overtimeMs,
    };
  }

  const remainingSec = Number.isFinite(input.remainingSec)
    ? Math.max(0, Math.ceil(input.remainingSec))
    : 0;
  return { label: formatClock(remainingSec), state: "countdown", overtimeMs: 0 };
}

/** Texto da sub-linha abaixo da barra: "12 min estudados de 60 min". */
export function studiedSubline(studiedMin: number, budgetMin: number): string {
  const studied = Number.isFinite(studiedMin) ? Math.max(0, Math.floor(studiedMin)) : 0;
  const budget = Number.isFinite(budgetMin) ? Math.max(0, Math.round(budgetMin)) : 0;
  const studiedText = `${studied} min estudado${studied === 1 ? "" : "s"}`;
  return budget > 0 ? `${studiedText} de ${budget} min` : studiedText;
}

/**
 * Variante curta da coluna esquerda em paisagem: "12 de 60 min estudados".
 * Cabe nos 260px do rail sem truncar, inclusive com 0 min.
 */
export function studiedLandscapeSubline(studiedMin: number, budgetMin: number): string {
  const studied = Number.isFinite(studiedMin) ? Math.max(0, Math.floor(studiedMin)) : 0;
  const budget = Number.isFinite(budgetMin) ? Math.max(0, Math.round(budgetMin)) : 0;
  const studiedText = budget > 0 ? `${studied} de ${budget} min estudados` : `${studied} min estudados`;
  return studiedText;
}

/** Rótulo acessível do número principal, coerente com o estado mostrado. */
export function timerHeadlineAria(headline: { label: string; state: TimerHeadlineState }): string {
  if (headline.state === "overtime") return `Tempo estourado: ${headline.label}`;
  if (headline.state === "elapsed") return `Tempo estudado: ${headline.label}`;
  return `Tempo restante: ${headline.label}`;
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
  const remainingSec = Math.ceil(remainingMs / 1000);
  const headline = timerHeadline({
    budgetMin: input.budgetMin,
    elapsedMs,
    elapsedSec,
    remainingSec,
  });
  const studiedMin = studiedMinutes(elapsedSec);

  return {
    elapsedMs,
    elapsedSec,
    remainingMs,
    remainingSec,
    progress,
    expired,
    clock: formatClock(elapsedSec),
    remainingClock: formatClock(remainingSec),
    headline: headline.label,
    headlineState: headline.state,
    overtimeMs: headline.overtimeMs,
    subline: studiedSubline(studiedMin, input.budgetMin),
    landscapeSubline: studiedLandscapeSubline(studiedMin, input.budgetMin),
    studiedMin,
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
