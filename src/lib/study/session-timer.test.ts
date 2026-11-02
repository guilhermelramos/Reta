import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completedSnackbarText,
  endDialogTitle,
  sessionTimerView,
  studiedMinutes,
  studiedSubline,
  timerHeadline,
  timerHeadlineAria,
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

describe("session-timer: número principal (restante/estourado)", () => {
  it("mostra o tempo restante enquanto o bloco corre", () => {
    const view = sessionTimerView({
      budgetMin: 30,
      timer: runningAt(NOW - 15 * MIN),
      now: NOW,
    });

    assert.equal(view.headline, "15:00");
    assert.equal(view.headlineState, "countdown");
    assert.equal(view.overtimeMs, 0);
    assert.equal(view.headline, view.remainingClock);
  });

  it("depois da meta troca para +MM:SS com o estouro exato", () => {
    const view = sessionTimerView({
      budgetMin: 20,
      timer: runningAt(NOW - 22 * MIN - 30_000),
      now: NOW,
    });

    assert.equal(view.expired, true);
    assert.equal(view.headline, "+02:30");
    assert.equal(view.headlineState, "overtime");
    assert.equal(view.overtimeMs, 2 * MIN + 30_000);
    assert.equal(view.studiedMin, 22);
  });

  it("no instante exato da meta ainda mostra 00:00, sem sinal de estouro", () => {
    const view = sessionTimerView({
      budgetMin: 10,
      timer: runningAt(NOW - 10 * MIN),
      now: NOW,
    });

    assert.equal(view.expired, true);
    assert.equal(view.headline, "00:00");
    assert.equal(view.headlineState, "countdown");
    assert.equal(view.overtimeMs, 0);
  });

  it("estouro acima de uma hora não perde o formato H:MM:SS", () => {
    assert.deepEqual(
      timerHeadline({
        budgetMin: 30,
        elapsedMs: 90 * MIN,
        elapsedSec: 90 * 60,
        remainingSec: 0,
      }),
      { label: "+1:00:00", state: "overtime", overtimeMs: 60 * MIN },
    );
  });

  it("bloco sem meta mostra o decorrido em vez de um 00:00 parado", () => {
    const view = sessionTimerView({
      budgetMin: 0,
      timer: runningAt(NOW - 7 * MIN),
      now: NOW,
    });

    assert.equal(view.headline, "07:00");
    assert.equal(view.headlineState, "elapsed");
    assert.equal(view.expired, false);
  });

  it("não deixa o restante negativo escapar para a tela", () => {
    const headline = timerHeadline({
      budgetMin: 5,
      elapsedMs: 5 * MIN + 400,
      elapsedSec: 5 * 60,
      remainingSec: -1,
    });
    assert.equal(headline.label, "+00:01");
  });

  it("o rótulo acessível acompanha o estado do número", () => {
    assert.equal(
      timerHeadlineAria({ label: "15:00", state: "countdown" }),
      "Tempo restante: 15:00",
    );
    assert.equal(timerHeadlineAria({ label: "+02:30", state: "overtime" }), "Tempo estourado: +02:30");
    assert.equal(timerHeadlineAria({ label: "07:00", state: "elapsed" }), "Tempo estudado: 07:00");
  });
});

describe("session-timer: sub-linha estudado de meta", () => {
  it("usa singular com 1 minuto e plural nos demais", () => {
    assert.equal(studiedSubline(1, 60), "1 min estudado de 60 min");
    assert.equal(studiedSubline(12, 60), "12 min estudados de 60 min");
    assert.equal(studiedSubline(0, 15), "0 min estudados de 15 min");
  });

  it("sem meta não inventa um 'de 0 min'", () => {
    assert.equal(studiedSubline(3, 0), "3 min estudados");
  });

  it("ignora valores inválidos", () => {
    assert.equal(studiedSubline(Number.NaN, -5), "0 min estudados");
  });

  it("a view entrega a sub-linha pronta para o cabeçalho", () => {
    const view = sessionTimerView({
      budgetMin: 40,
      timer: runningAt(NOW - 5 * MIN, 10 * MIN),
      now: NOW,
    });
    assert.equal(view.subline, "15 min estudados de 40 min");
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
