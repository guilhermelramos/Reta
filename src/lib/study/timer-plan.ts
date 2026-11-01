import { timerElapsedMs, timerExpired, timerRemainingMs } from "./time.ts";
import type { SessionTimerState } from "./time.ts";

/**
 * Planejamento do término do bloco.
 *
 * O cronômetro continua sendo derivado de `startedAt` + acumulado (ver
 * `time.ts`). Este módulo só responde a uma pergunta: qual instante deve ficar
 * gravado em `StudySession.endsAt` e o que fazer com o alarme/notificação?
 *
 * É puro de propósito: a regra de pausa, retomada e reabertura pode ser testada
 * sem Capacitor, sem IndexedDB e sem relógio real.
 */

export type TimerEndsAtPlan = {
  /** Fim previsto (epoch ms) do trecho em andamento; `null` quando pausado. */
  endsAt: number | null;
  /** Quanto falta para a meta do bloco no instante do cálculo. */
  remainingMs: number;
  /** A meta já foi cumprida. */
  expired: boolean;
  /** Vale (re)agendar o alarme exato/inexato agora. */
  scheduleAlarm: boolean;
  /** O timer já começou alguma vez: cabe manter a notificação persistente. */
  showOngoing: boolean;
};

/** `now + restante`, ou `null` quando não falta nada. */
export function timerEndsAtFromNow(input: {
  budgetMin: number;
  elapsedMs: number;
  now: number;
}): number | null {
  const remainingMs = timerRemainingMs(input.budgetMin, input.elapsedMs);
  return remainingMs > 0 ? input.now + remainingMs : null;
}

/**
 * Retomada (ou mudança de meta): o trecho começa agora, então o fim previsto é
 * recalculado a partir do que ainda falta — sem herdar um `endsAt` antigo.
 */
export function resumeTimerPlan(input: {
  budgetMin: number;
  elapsedMs: number;
  now: number;
}): TimerEndsAtPlan {
  const remainingMs = timerRemainingMs(input.budgetMin, input.elapsedMs);
  const expired = timerExpired(input.budgetMin, input.elapsedMs);
  const endsAt = timerEndsAtFromNow(input);
  return {
    endsAt,
    remainingMs,
    expired,
    scheduleAlarm: endsAt != null,
    showOngoing: true,
  };
}

/**
 * Pausa: não existe mais um fim previsto correndo. O `endsAt` gravado na
 * sessão deve virar `null` e o alarme tem de ser cancelado.
 */
export function pauseTimerPlan(input: { budgetMin: number; elapsedMs: number }): TimerEndsAtPlan {
  return {
    endsAt: null,
    remainingMs: timerRemainingMs(input.budgetMin, input.elapsedMs),
    expired: timerExpired(input.budgetMin, input.elapsedMs),
    scheduleAlarm: false,
    showOngoing: true,
  };
}

/**
 * Reabertura do app/bloco com a sessão ainda aberta.
 *
 * - Pausado (`startedAt` nulo): nada corre, logo `endsAt` é `null`.
 * - `endsAt` já gravado: é a fonte de verdade; se ainda estiver no futuro, o
 *   alarme é reagendado exatamente para ele.
 * - Registro antigo sem `endsAt`: deriva `now + restante`, que equivale a
 *   `startedAt + (meta - acumulado)` graças ao tempo real decorrido.
 * - `endsAt` no passado (ou meta já cumprida): não reagenda; o alarme já
 *   disparou ou o bloco terminou enquanto o app estava fechado.
 */
export function restoreTimerPlan(input: {
  budgetMin: number;
  timer: SessionTimerState;
  storedEndsAt?: number | null;
  now: number;
}): TimerEndsAtPlan {
  const elapsedMs = timerElapsedMs(input.timer, input.now);
  const remainingMs = timerRemainingMs(input.budgetMin, elapsedMs);
  const expired = timerExpired(input.budgetMin, elapsedMs);

  if (input.timer.startedAt == null) {
    return { endsAt: null, remainingMs, expired, scheduleAlarm: false, showOngoing: false };
  }

  const stored =
    typeof input.storedEndsAt === "number" && Number.isFinite(input.storedEndsAt)
      ? input.storedEndsAt
      : null;
  const endsAt =
    stored ??
    timerEndsAtFromNow({
      budgetMin: input.budgetMin,
      elapsedMs,
      now: input.now,
    });

  return {
    endsAt,
    remainingMs,
    expired,
    scheduleAlarm: endsAt != null && endsAt > input.now && !expired,
    showOngoing: true,
  };
}
