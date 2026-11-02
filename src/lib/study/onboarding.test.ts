import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasActiveAiKey,
  hasImportedPlan,
  isKeyCheckSuccess,
  isValidKeyDraft,
  KEY_CHECK_INVALID_MESSAGE,
  KEY_CHECK_OFFLINE_MESSAGE,
  KEY_CHECK_RATE_LIMIT_MESSAGE,
  keyCheckErrorCopy,
  nextOnboardingStep,
  previousOnboardingStep,
  shouldShowOnboarding,
  shouldShowPlanDayCount,
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

  it("gate usa a credencial do provedor ativo (xAI por padrão)", () => {
    assert.equal(
      shouldShowOnboarding({
        ...fresh,
        hasXaiKey: false,
        hasOpenRouterKey: true,
        aiProvider: "openrouter",
      }),
      false,
    );
    // Chave do OpenRouter não conta quando a xAI é o provedor ativo.
    assert.equal(
      shouldShowOnboarding({
        ...fresh,
        hasXaiKey: false,
        hasOpenRouterKey: true,
        aiProvider: "xai",
      }),
      true,
    );
    // Chave da xAI não conta quando o OpenRouter está ativo.
    assert.equal(
      shouldShowOnboarding({
        ...fresh,
        hasXaiKey: true,
        hasOpenRouterKey: false,
        aiProvider: "openrouter",
      }),
      true,
    );
  });

  it("hasActiveAiKey escolhe a chave do provedor ativo", () => {
    assert.equal(hasActiveAiKey({ hasXaiKey: true }), true);
    assert.equal(hasActiveAiKey({ aiProvider: "xai", hasXaiKey: true }), true);
    assert.equal(hasActiveAiKey({ aiProvider: "openrouter", hasOpenRouterKey: true }), true);
    assert.equal(
      hasActiveAiKey({ aiProvider: "openrouter", hasXaiKey: true, hasOpenRouterKey: false }),
      false,
    );
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

describe("nextOnboardingStep", () => {
  it("avança um passo sem concluir a introdução no passo 2", () => {
    // "Agora não (usar plano de exemplo)" sai da Planilha só para o Professor.
    assert.equal(nextOnboardingStep(1), 2);
    assert.equal(nextOnboardingStep(2), 3);
    assert.equal(nextOnboardingStep(0), 1);
  });

  it("não passa do último passo", () => {
    assert.equal(nextOnboardingStep(3), 3);
    assert.equal(nextOnboardingStep(9), 3);
    assert.equal(nextOnboardingStep(2.8), 3);
    assert.equal(nextOnboardingStep(-4), 1);
  });
});

describe("shouldShowPlanDayCount", () => {
  it("esconde a contagem enquanto o plano é só o de exemplo", () => {
    assert.equal(shouldShowPlanDayCount({ seeded: true, dayCount: 36 }), false);
  });

  it("mostra depois de importar nesta sessão", () => {
    assert.equal(
      shouldShowPlanDayCount({ seeded: true, dayCount: 36, importedThisSession: true }),
      true,
    );
    assert.equal(
      shouldShowPlanDayCount({ seeded: false, dayCount: 36, importedThisSession: true }),
      true,
    );
  });

  it("mostra para uma planilha importada em uma sessão anterior", () => {
    assert.equal(shouldShowPlanDayCount({ seeded: false, dayCount: 12 }), true);
  });

  it("esconde quando não há dias no plano", () => {
    assert.equal(shouldShowPlanDayCount({ seeded: false, dayCount: 0 }), false);
    assert.equal(shouldShowPlanDayCount({ seeded: true, dayCount: 0 }), false);
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

describe("isKeyCheckSuccess", () => {
  it("aceita o ping com texto", () => {
    assert.equal(isKeyCheckSuccess({ ok: true, data: { text: "ok" } }), true);
  });

  it("recusa uma Response 200 de HTML que só tem ok:true", () => {
    // `window.Response` não existe no Node; o formato é o que importa.
    assert.equal(isKeyCheckSuccess({ ok: true, status: 200 }), false);
  });

  it("recusa erro, vazio e nulo", () => {
    assert.equal(isKeyCheckSuccess({ ok: false, error: "Chave inválida." }), false);
    assert.equal(isKeyCheckSuccess({ ok: true, data: { text: "   " } }), false);
    assert.equal(isKeyCheckSuccess(null), false);
    assert.equal(isKeyCheckSuccess(undefined), false);
  });
});
