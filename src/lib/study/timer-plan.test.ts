import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pauseTimerPlan,
  restoreTimerPlan,
  resumeTimerPlan,
  timerEndsAtFromNow,
} from "./timer-plan.ts";
import { timerElapsedMs, timerPause, timerStart } from "./time.ts";
import type { SessionTimerState } from "./time.ts";

const MIN = 60_000;
const NOW = Date.UTC(2026, 2, 10, 17, 0, 0);

function stopped(accumulatedElapsedMs = 0): SessionTimerState {
  return { startedAt: null, accumulatedElapsedMs };
}

describe("timer-plan: início e retomada", () => {
  it("retomar calcula endsAt como agora + o que ainda falta", () => {
    const plan = resumeTimerPlan({ budgetMin: 30, elapsedMs: 10 * MIN, now: NOW });

    assert.equal(plan.endsAt, NOW + 20 * MIN);
    assert.equal(plan.remainingMs, 20 * MIN);
    assert.equal(plan.expired, false);
    assert.equal(plan.scheduleAlarm, true);
    assert.equal(plan.showOngoing, true);
  });

  it("retomada depois de uma pausa não desconta o tempo parado", () => {
    // Rodou 10 min, ficou pausado 5 min e retomou.
    const started = timerStart(stopped(), NOW);
    const paused = timerPause(started, NOW + 10 * MIN);
    const pausedPlan = pauseTimerPlan({
      budgetMin: 30,
      elapsedMs: timerElapsedMs(paused, NOW + 15 * MIN),
    });

    assert.equal(pausedPlan.endsAt, null);
    assert.equal(pausedPlan.scheduleAlarm, false);
    assert.equal(pausedPlan.remainingMs, 20 * MIN);

    const resumedAt = NOW + 15 * MIN;
    const resumed = timerStart(paused, resumedAt);
    const plan = resumeTimerPlan({
      budgetMin: 30,
      elapsedMs: timerElapsedMs(resumed, resumedAt),
      now: resumedAt,
    });

    // Continua valendo o acumulado (10 min): o fim é 20 min depois da retomada.
    assert.equal(plan.endsAt, resumedAt + 20 * MIN);
    assert.equal(plan.scheduleAlarm, true);
  });

  it("quando a meta já foi cumprida não há alarme a agendar", () => {
    const plan = resumeTimerPlan({ budgetMin: 30, elapsedMs: 30 * MIN, now: NOW });

    assert.equal(plan.endsAt, null);
    assert.equal(plan.remainingMs, 0);
    assert.equal(plan.expired, true);
    assert.equal(plan.scheduleAlarm, false);
  });

  it("budget zero (bloco sem tempo) não gera endsAt", () => {
    assert.equal(timerEndsAtFromNow({ budgetMin: 0, elapsedMs: 0, now: NOW }), null);
  });
});

describe("timer-plan: reabertura do app", () => {
  it("reabrir antes do fim preserva o endsAt gravado e reagenda", () => {
    const storedEndsAt = NOW + 12 * MIN;
    const plan = restoreTimerPlan({
      budgetMin: 30,
      timer: { startedAt: NOW - 18 * MIN, accumulatedElapsedMs: 0 },
      storedEndsAt,
      now: NOW,
    });

    assert.equal(plan.endsAt, storedEndsAt);
    assert.equal(plan.remainingMs, 12 * MIN);
    assert.equal(plan.expired, false);
    assert.equal(plan.scheduleAlarm, true);
  });

  it("reabrir depois do fim não reagenda o alarme", () => {
    const plan = restoreTimerPlan({
      budgetMin: 30,
      timer: { startedAt: NOW - 40 * MIN, accumulatedElapsedMs: 0 },
      storedEndsAt: NOW - 10 * MIN,
      now: NOW,
    });

    assert.equal(plan.endsAt, NOW - 10 * MIN);
    assert.equal(plan.remainingMs, 0);
    assert.equal(plan.expired, true);
    assert.equal(plan.scheduleAlarm, false);
  });

  it("registro antigo sem endsAt deriva o fim de startedAt + acumulado", () => {
    const plan = restoreTimerPlan({
      budgetMin: 30,
      timer: { startedAt: NOW - 10 * MIN, accumulatedElapsedMs: 0 },
      now: NOW,
    });

    assert.equal(plan.endsAt, NOW + 20 * MIN);
    assert.equal(plan.scheduleAlarm, true);
  });

  it("reabrir pausado zera o endsAt e não agenda", () => {
    const plan = restoreTimerPlan({
      budgetMin: 30,
      timer: stopped(10 * MIN),
      storedEndsAt: NOW + 20 * MIN,
      now: NOW,
    });

    assert.equal(plan.endsAt, null);
    assert.equal(plan.scheduleAlarm, false);
    assert.equal(plan.showOngoing, false);
  });
});
