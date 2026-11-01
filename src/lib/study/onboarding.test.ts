import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasImportedPlan,
  isValidKeyDraft,
  KEY_CHECK_INVALID_MESSAGE,
  KEY_CHECK_OFFLINE_MESSAGE,
  KEY_CHECK_RATE_LIMIT_MESSAGE,
  keyCheckErrorCopy,
  previousOnboardingStep,
  shouldShowOnboarding,
} from "./onboarding.ts";

describe("shouldShowOnboarding", () => {
  const fresh = {
    onboardingDone: false,
    hasXaiKey: false,
    hasImportedPlan: false,
  };

  it("mostra a introdução na primeira abertura", () => {
    assert.equal(shouldShowOnboarding(fresh), true);
  });

  it("não mostra de novo depois de concluída", () => {
    assert.equal(shouldShowOnboarding({ ...fresh, onboardingDone: true }), false);
  });

  it("considera feito quando já existe chave xAI salva", () => {
    assert.equal(shouldShowOnboarding({ ...fresh, hasXaiKey: true }), false);
  });

  it("considera feito quando o plano veio de uma planilha importada", () => {
    assert.equal(shouldShowOnboarding({ ...fresh, hasImportedPlan: true }), false);
  });

  it("o plano semeado na primeira abertura não conta como importação", () => {
    assert.equal(hasImportedPlan(true, 30), false);
    assert.equal(hasImportedPlan(false, 30), true);
    assert.equal(hasImportedPlan(false, 0), false);
  });
});

describe("previousOnboardingStep", () => {
  it("volta um passo e para na primeira tela", () => {
    assert.equal(previousOnboardingStep(3), 2);
    assert.equal(previousOnboardingStep(2), 1);
    assert.equal(previousOnboardingStep(1), 0);
    assert.equal(previousOnboardingStep(0), 0);
  });

  it("tolera valores fora da faixa", () => {
    assert.equal(previousOnboardingStep(-4), 0);
    assert.equal(previousOnboardingStep(9), 2);
    assert.equal(previousOnboardingStep(2.8), 1);
  });
});

describe("keyCheckErrorCopy", () => {
  it("401 e 403 viram chave inválida", () => {
    assert.deepEqual(keyCheckErrorCopy({ status: 401 }), {
      kind: "invalid",
      message: KEY_CHECK_INVALID_MESSAGE,
    });
    assert.equal(keyCheckErrorCopy({ status: 403 }).message, KEY_CHECK_INVALID_MESSAGE);
    assert.equal(keyCheckErrorCopy({ kind: "unauthorized" }).message, KEY_CHECK_INVALID_MESSAGE);
  });

  it("429 vira limite da conta xAI", () => {
    assert.deepEqual(keyCheckErrorCopy({ status: 429 }), {
      kind: "rate-limit",
      message: KEY_CHECK_RATE_LIMIT_MESSAGE,
    });
    assert.equal(keyCheckErrorCopy({ kind: "rate-limit" }).message, KEY_CHECK_RATE_LIMIT_MESSAGE);
  });

  it("offline e timeout pedem para verificar depois em Ajustes", () => {
    assert.deepEqual(keyCheckErrorCopy({ kind: "offline" }), {
      kind: "offline",
      message: KEY_CHECK_OFFLINE_MESSAGE,
    });
    assert.equal(keyCheckErrorCopy({ kind: "timeout" }).message, KEY_CHECK_OFFLINE_MESSAGE);
    assert.equal(
      keyCheckErrorCopy(undefined, { online: false }).message,
      KEY_CHECK_OFFLINE_MESSAGE,
    );
  });

  it("não acusa a chave quando o erro é do servidor", () => {
    const copy = keyCheckErrorCopy({ kind: "server", status: 503 });
    assert.equal(copy.kind, "unknown");
    assert.doesNotMatch(copy.message, /inválida|revogada/i);
  });

  it("400 de chave malformada da xAI vira chave inválida", () => {
    assert.deepEqual(
      keyCheckErrorCopy({
        kind: "bad-request",
        status: 400,
        message: "A IA recusou o pedido (erro 400): Incorrect API key provided.",
      }),
      { kind: "invalid", message: KEY_CHECK_INVALID_MESSAGE },
    );
    // Um 400 que não fala de chave continua neutro.
    assert.equal(
      keyCheckErrorCopy({ kind: "bad-request", status: 400, message: "modelo inválido" }).kind,
      "unknown",
    );
  });

  it("o status HTTP tem prioridade sobre o kind genérico", () => {
    assert.equal(keyCheckErrorCopy({ kind: "unknown", status: 401 }).kind, "invalid");
    assert.equal(keyCheckErrorCopy({ kind: "unknown", status: 429 }).kind, "rate-limit");
  });
});

describe("isValidKeyDraft", () => {
  it("recusa chave vazia ou só com espaços", () => {
    assert.equal(isValidKeyDraft(""), false);
    assert.equal(isValidKeyDraft("   \n "), false);
    assert.equal(isValidKeyDraft("  xai-123  "), true);
  });
});
