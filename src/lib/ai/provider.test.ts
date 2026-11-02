import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_AI_PREFERENCES,
  aiPreferences,
  aiProviderLabel,
  isAiProvider,
  isOpenRouterReady,
  normalizeAiPreferences,
  normalizeFallbacks,
  normalizeModelId,
  selectedModels,
} from "./provider.ts";

describe("normalizeAiPreferences", () => {
  it("usa xAI por padrão quando o ajuste não existe", () => {
    assert.deepEqual(normalizeAiPreferences(undefined), DEFAULT_AI_PREFERENCES);
    assert.deepEqual(normalizeAiPreferences(null), {
      provider: "xai",
      openRouterModel: "",
      openRouterFallbacks: [],
    });
  });

  it("preserva OpenRouter, o modelo e os fallbacks", () => {
    assert.deepEqual(
      normalizeAiPreferences({
        aiProvider: "openrouter",
        openRouterModel: "  google/gemini-2.5-flash  ",
        openRouterFallbacks: [" openrouter/auto ", "", 42],
      }),
      {
        provider: "openrouter",
        openRouterModel: "google/gemini-2.5-flash",
        openRouterFallbacks: ["openrouter/auto"],
      },
    );
  });

  it("cai em xAI com provedor desconhecido ou de outro tipo", () => {
    assert.equal(normalizeAiPreferences({ aiProvider: "openai" }).provider, "xai");
    assert.equal(normalizeAiPreferences({ aiProvider: 1 }).provider, "xai");
  });

  it("não repete o principal nos fallbacks", () => {
    assert.deepEqual(
      normalizeAiPreferences({
        aiProvider: "openrouter",
        openRouterModel: "a/x",
        openRouterFallbacks: ["a/x", "b/y", "b/y", " c/z "],
      }).openRouterFallbacks,
      ["b/y", "c/z"],
    );
  });

  it("mantém o modelo salvo mesmo quando o provedor ativo é xAI", () => {
    const prefs = aiPreferences({
      aiProvider: "xai",
      openRouterModel: "openrouter/auto",
      openRouterFallbacks: ["x/y"],
    });
    assert.deepEqual(prefs, {
      provider: "xai",
      openRouterModel: "openrouter/auto",
      openRouterFallbacks: ["x/y"],
    });
  });
});

describe("normalizeModelId / normalizeFallbacks", () => {
  it("aceita só texto e limpa as pontas", () => {
    assert.equal(normalizeModelId("  a/x  "), "a/x");
    assert.equal(normalizeModelId(null), "");
    assert.equal(normalizeModelId(42), "");
  });

  it("descarta lixo e duplicatas", () => {
    assert.deepEqual(normalizeFallbacks([" a/x ", "a/x", "", null, "b/y"], "a/x"), ["b/y"]);
    assert.deepEqual(normalizeFallbacks("a/x"), []);
  });
});

describe("seleção de modelos", () => {
  it("devolve principal + fallbacks na ordem", () => {
    assert.deepEqual(
      selectedModels({
        provider: "openrouter",
        openRouterModel: "a/x",
        openRouterFallbacks: ["b/y", "c/z"],
      }),
      ["a/x", "b/y", "c/z"],
    );
  });

  it("devolve lista vazia sem modelo principal", () => {
    assert.deepEqual(
      selectedModels({
        provider: "openrouter",
        openRouterModel: "  ",
        openRouterFallbacks: ["b/y"],
      }),
      [],
    );
  });

  it("OpenRouter só está pronto com provedor e modelo", () => {
    const base = { openRouterModel: "a/x", openRouterFallbacks: [] };
    assert.equal(isOpenRouterReady({ ...base, provider: "openrouter" }), true);
    assert.equal(isOpenRouterReady({ ...base, provider: "xai" }), false);
    assert.equal(
      isOpenRouterReady({ provider: "openrouter", openRouterModel: "", openRouterFallbacks: [] }),
      false,
    );
  });
});

describe("rótulos", () => {
  it("reconhece só os dois provedores e mantém a grafia do app", () => {
    assert.equal(isAiProvider("xai"), true);
    assert.equal(isAiProvider("openrouter"), true);
    assert.equal(isAiProvider("gemini"), false);
    assert.equal(aiProviderLabel("xai"), "xAI");
    assert.equal(aiProviderLabel("openrouter"), "OpenRouter");
  });
});
