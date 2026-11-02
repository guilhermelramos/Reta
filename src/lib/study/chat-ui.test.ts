import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSendMessage, quickQuestionsVisible } from "./chat-ui.ts";

describe("professor: chips de pergunta rápida", () => {
  it("aparecem antes da primeira mensagem enviada", () => {
    assert.equal(quickQuestionsVisible(0), true);
  });

  it("somem depois da primeira mensagem enviada", () => {
    assert.equal(quickQuestionsVisible(1), false);
    assert.equal(quickQuestionsVisible(4), false);
  });

  it("contagem inválida se comporta como conversa vazia (não esconde o atalho)", () => {
    assert.equal(quickQuestionsVisible(Number.NaN), true);
    assert.equal(quickQuestionsVisible(-3), true);
  });
});

describe("professor: envio da mensagem", () => {
  it("só habilita com texto digitado e sem requisição em curso", () => {
    assert.equal(canSendMessage("Explique de novo", false), true);
    assert.equal(canSendMessage("   ", false), false);
    assert.equal(canSendMessage("", false), false);
    assert.equal(canSendMessage("Explique de novo", true), false);
  });
});
