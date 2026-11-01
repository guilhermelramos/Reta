import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completedSnackbarText,
  endDialogTitle,
  sessionTimerView,
  studiedMinutes,
} from "./session-timer.ts";
import type { SessionTimerState } from "./time.ts";

const NOW = Date.UTC(2026, 10, 1, 18, 0, 0);
const MIN = 60_000;

function runningAt(startedAt: number, accumulatedElapsedMs = 0): SessionTimerState {
  return { startedAt, accumulatedElapsedMs };
}

describe("session-timer: tempo restante e progresso", () => {
  it("metade do bloco rende 50% e o restante em MM:SS", () => {
    const view = sessionTimerView({
      budgetMin: 30,
      timer: runningAt(NOW - 15 * MIN),
      now: NOW,
    });

    assert.equal(view.remainingMs, 15 * MIN);
    assert.equal(view.remainingSec, 15 * 60);
    assert.equal(view.remainingClock, "15:00");
    assert.equal(view.clock, "15:00");
    assert.equal(view.progress, 0.5);
    assert.equal(view.expired, false);
    assert.equal(view.state, "running");
  });

  it("soma o acumulado de trechos anteriores (pausa/retomada)", () => {
    const view = sessionTimerView({
      budgetMin: 40,
      timer: runningAt(NOW - 5 * MIN, 10 * MIN),
      now: NOW,
    });

    assert.equal(view.elapsedMs, 15 * MIN);
    assert.equal(view.studiedMin, 15);
    assert.equal(view.remainingClock, "25:00");
    assert.equal(view.progress, 0.375);
  });

  it("pausado não conta o tempo parado", () => {
    const view = sessionTimerView({
      budgetMin: 30,
      timer: { startedAt: null, accumulatedElapsedMs: 8 * MIN },
      now: NOW,
    });

    assert.equal(view.elapsedSec, 8 * 60);
    assert.equal(view.state, "paused");
    assert.equal(view.remainingClock, "22:00");
  });

  it("progresso trava em 100% e o restante em zero depois da meta", () => {
    const view = sessionTimerView({
      budgetMin: 20,
      timer: runningAt(NOW - 25 * MIN),
      now: NOW,
    });

    assert.equal(view.progress, 1);
    assert.equal(view.remainingMs, 0);
    assert.equal(view.remainingClock, "00:00");
    assert.equal(view.expired, true);
    assert.equal(view.state, "expired");
  });

  it("bloco sem meta não inventa progresso nem expira", () => {
    const view = sessionTimerView({
      budgetMin: 0,
      timer: runningAt(NOW - 3 * MIN),
      now: NOW,
    });

    assert.equal(view.progress, 0);
    assert.equal(view.expired, false);
  });

  it("arredonda o restante para cima para não mostrar 00:00 adiantado", () => {
    const view = sessionTimerView({
      budgetMin: 1,
      timer: runningAt(NOW - 59_400),
      now: NOW,
    });

    assert.equal(view.remainingMs, 600);
    assert.equal(view.remainingClock, "00:01");
    assert.equal(view.expired, false);
  });
});

describe("session-timer: texto do diálogo e do snackbar", () => {
  it("usa os minutos inteiros estudados no diálogo", () => {
    assert.equal(endDialogTitle(23 * 60 + 45), "Encerrar e salvar 23 min?");
    assert.equal(endDialogTitle(1 * 60), "Encerrar e salvar 1 min?");
  });

  it("antes de um minuto o diálogo não diz 0 min", () => {
    assert.equal(endDialogTitle(0), "Encerrar e salvar menos de 1 min?");
    assert.equal(endDialogTitle(59), "Encerrar e salvar menos de 1 min?");
  });

  it("snackbar de conclusão repete os minutos salvos", () => {
    assert.equal(completedSnackbarText(23 * 60 + 30), "Bloco concluído · 23 min");
  });

  it("snackbar nunca mostra 0 min", () => {
    assert.equal(completedSnackbarText(12), "Bloco concluído · 1 min");
  });

  it("minutos estudados truncam e ignoram valores inválidos", () => {
    assert.equal(studiedMinutes(119.9), 1);
    assert.equal(studiedMinutes(-10), 0);
    assert.equal(studiedMinutes(Number.NaN), 0);
  });
});
