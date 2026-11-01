import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXACT_ALARM_PROMPT, shouldAskExactAlarms } from "./exact-alarm.ts";

const base = {
  native: true,
  asked: false,
  started: true,
  permission: "granted" as const,
  exactAlarms: "denied" as const,
};

describe("pedido contextual de alarmes exatos", () => {
  it("pergunta na primeira vez que o timer começa, com notificação liberada e alarme negado", () => {
    assert.equal(shouldAskExactAlarms(base), true);
  });

  it("não pergunta de novo depois da primeira vez", () => {
    assert.equal(shouldAskExactAlarms({ ...base, asked: true }), false);
  });

  it("não pergunta na web, sem timer correndo ou sem permissão de notificação", () => {
    assert.equal(shouldAskExactAlarms({ ...base, native: false }), false);
    assert.equal(shouldAskExactAlarms({ ...base, started: false }), false);
    assert.equal(shouldAskExactAlarms({ ...base, permission: "prompt" }), false);
    assert.equal(shouldAskExactAlarms({ ...base, permission: "denied" }), false);
  });

  it("não pergunta quando o alarme exato já está autorizado (ou não se aplica)", () => {
    assert.equal(shouldAskExactAlarms({ ...base, exactAlarms: "granted" }), false);
    assert.equal(shouldAskExactAlarms({ ...base, exactAlarms: "unsupported" }), false);
  });

  it("mantém a frase exata combinada com o Consultor", () => {
    assert.equal(
      EXACT_ALARM_PROMPT,
      "Para o aviso tocar no minuto certo com a tela bloqueada, permita alarmes exatos",
    );
  });
});
