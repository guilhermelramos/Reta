import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  timerElapsedMs,
  timerFromSession,
  timerPause,
  timerStart,
  timerToSession,
} from "./time.ts";

/**
 * Regressão do requisito "voltar não perde o timer": o estado salvo na sessão
 * usa timestamps reais, então sair da tela (voltar/minimizar/reload) não
 * congela nem reinicia a contagem.
 */
describe("timer da sessão sobrevive a sair da tela", () => {
  const t0 = 1_760_000_000_000;

  it("sessão rodando continua contando pelo horário real", () => {
    const saved = timerFromSession({ elapsedSec: 60, runStartedAt: t0, running: true });

    // 10 minutos depois, sem nenhum tick do setInterval:
    assert.equal(timerElapsedMs(saved, t0 + 10 * 60_000), 11 * 60_000);
  });

  it("retomar uma sessão pausada mantém running e runStartedAt", () => {
    const resumedAt = t0;
    const resumed = timerStart(
      timerFromSession({ elapsedSec: 60, runStartedAt: null, running: false }),
      resumedAt,
    );
    const persisted = timerToSession(resumed, resumedAt);

    assert.equal(persisted.running, true);
    assert.equal(persisted.runStartedAt, resumedAt);
    assert.equal(persisted.elapsedSec, 60);

    // Reload/reabertura depois de 5 min: 1 min já salvo + 5 min do trecho.
    const restored = timerFromSession(persisted);
    assert.equal(timerElapsedMs(restored, resumedAt + 5 * 60_000), 6 * 60_000);
  });

  it("sessão pausada não conta o tempo fora da tela", () => {
    const paused = timerPause(timerFromSession({ elapsedSec: 120, runStartedAt: t0, running: true }), t0 + 60_000);
    assert.equal(timerElapsedMs(paused, t0 + 30 * 60_000), 3 * 60_000);
  });

  it("retomar é idempotente e não duplica o tempo já andado", () => {
    const first = timerStart(timerFromSession({ elapsedSec: 0, runStartedAt: null, running: false }), t0);
    const second = timerStart(first, t0 + 60_000);
    assert.deepEqual(second, first);
    assert.equal(timerElapsedMs(second, t0 + 60_000), 60_000);
  });
});
