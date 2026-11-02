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

/* --------------------------- roteamento de provedor --------------------------- */

import { AiRequestError } from "./errors.ts";
import type { HttpRequest, HttpResponse } from "./openrouter/client.ts";
import { normalizeModel } from "./openrouter/client.ts";
import {
  aiOptionsFor,
  normalizeAiRequestOptions,
  professorMessagesWithImages,
  promptMessage,
  providerChat,
  routedModels,
  visionAttachmentGate,
  withVisionPreset,
  FREE_MODEL_ACTION_LABEL,
  VISION_ACTION_LABEL,
  VISION_BLOCKED_MESSAGE,
} from "./provider.ts";

const response = (status: number, data: unknown = {}, headers: Record<string, string> = {}) =>
  ({ status, data, headers }) satisfies HttpResponse;

function openRouterTransport(reply: HttpResponse | ((request: HttpRequest) => HttpResponse)) {
  const calls: HttpRequest[] = [];
  const transport = async (request: HttpRequest) => {
    calls.push(request);
    return typeof reply === "function" ? reply(request) : reply;
  };
  return { calls, transport };
}

const OPENROUTER_PREFS = {
  provider: "openrouter" as const,
  openRouterModel: "google/gemini-2.5-flash",
  openRouterFallbacks: ["meta-llama/llama-3.3-70b-instruct:free"],
};

describe("routedModels — fallback nativo", () => {
  it("manda principal + fallbacks + openrouter/auto, sem repetir", () => {
    assert.deepEqual(routedModels(OPENROUTER_PREFS), [
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.3-70b-instruct:free",
      "openrouter/auto",
    ]);
  });

  it("sem modelo configurado cai direto no openrouter/auto", () => {
    assert.deepEqual(
      routedModels({ provider: "openrouter", openRouterModel: "", openRouterFallbacks: [] }),
      ["openrouter/auto"],
    );
  });

  it("não duplica o auto quando ele já é o principal", () => {
    assert.deepEqual(
      routedModels({
        provider: "openrouter",
        openRouterModel: "openrouter/auto",
        openRouterFallbacks: ["openrouter/auto", "x/y"],
      }),
      ["openrouter/auto", "x/y"],
    );
  });
});

describe("providerChat", () => {
  it("xAI delega ao caminho atual e não chama o transporte do OpenRouter", async () => {
    const { calls, transport } = openRouterTransport(response(500));
    const seen: unknown[] = [];
    const text = await providerChat(
      {
        preferences: { provider: "xai", openRouterModel: "", openRouterFallbacks: [] },
        transport,
      },
      { messages: [{ role: "user", content: "oi" }], maxTokens: 40 },
      async (request) => {
        seen.push(request);
        return "resposta xai";
      },
    );
    assert.equal(text, "resposta xai");
    assert.equal(seen.length, 1);
    assert.equal(calls.length, 0);
  });

  it("OpenRouter envia models, cabeçalhos e devolve o texto", async () => {
    const { calls, transport } = openRouterTransport(
      response(200, { choices: [{ message: { content: "ok" } }], model: "auto" }),
    );
    const text = await providerChat(
      { preferences: OPENROUTER_PREFS, openRouterKey: " sk-or-teste ", transport },
      { messages: [{ role: "user", content: "Explique." }], maxTokens: 100 },
      async () => {
        throw new Error("não deveria chamar a xAI");
      },
    );
    assert.equal(text, "ok");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://openrouter.ai/api/v1/chat/completions");
    assert.deepEqual((calls[0]?.body as { models: string[] }).models, [
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.3-70b-instruct:free",
      "openrouter/auto",
    ]);
    assert.equal(calls[0]?.headers.Authorization, "Bearer sk-or-teste");
    assert.equal(calls[0]?.headers["HTTP-Referer"], "https://github.com/guilhermelramos/Reta");
    assert.equal(calls[0]?.headers["X-Title"], "Reta");
  });

  it("sem chave do OpenRouter falha antes da rede", async () => {
    const { calls, transport } = openRouterTransport(response(200));
    await assert.rejects(
      () =>
        providerChat(
          { preferences: OPENROUTER_PREFS, transport },
          { messages: [{ role: "user", content: "oi" }], maxTokens: 10 },
          async () => "x",
        ),
      (error: unknown) =>
        error instanceof AiRequestError &&
        error.kind === "missing-key" &&
        error.provider === "openrouter",
    );
    assert.equal(calls.length, 0);
  });

  it("mapeia 401/402/429 do OpenRouter mantendo o provedor", async () => {
    for (const [status, kind, message] of [
      [401, "unauthorized", "Chave do OpenRouter inválida ou revogada"],
      [402, "no-credits", "Sem créditos no OpenRouter"],
      [429, "rate-limit", "Limite de uso atingido"],
    ] as const) {
      const { transport } = openRouterTransport(response(status, {}, status === 429 ? { "Retry-After": "9" } : {}));
      await assert.rejects(
        () =>
          providerChat(
            { preferences: OPENROUTER_PREFS, openRouterKey: "sk-or-x", transport },
            { messages: [{ role: "user", content: "oi" }], maxTokens: 10 },
            async () => "x",
          ),
        (error: unknown) => {
          assert.ok(error instanceof AiRequestError);
          assert.equal(error.kind, kind);
          assert.equal(error.provider, "openrouter");
          assert.match(error.message, new RegExp(message));
          if (status === 429) assert.equal(error.retryAfterSeconds, 9);
          return true;
        },
      );
    }
  });
});

describe("conteúdo com imagem", () => {
  it("texto simples continua string; com imagem vira partes", () => {
    assert.deepEqual(promptMessage("Explique."), { role: "user", content: "Explique." });
    const withImage = promptMessage("Veja a foto.", ["data:image/png;base64,AAA"]);
    assert.deepEqual(withImage.content, [
      { type: "text", text: "Veja a foto." },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } },
    ]);
  });

  it("anexa as imagens só à última fala da pessoa", () => {
    const messages = professorMessagesWithImages(
      [
        { role: "system", content: "Você é o professor." },
        { role: "user", content: "primeira" },
        { role: "assistant", content: "resposta" },
        { role: "user", content: "segunda" },
      ],
      ["data:image/jpeg;base64,BBB"],
    );
    assert.equal(typeof messages[1]?.content, "string");
    assert.deepEqual(messages[3]?.content, [
      { type: "text", text: "segunda" },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,BBB" } },
    ]);
  });
});

describe("gate de visão antes do envio", () => {
  const catalog = [
    normalizeModel({
      id: "texto/barato",
      pricing: { prompt: "0", completion: "0" },
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
    }),
    normalizeModel({
      id: "visao/boa",
      pricing: { prompt: "0.000001", completion: "0.000002" },
      architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
    }),
  ].filter((model): model is NonNullable<typeof model> => Boolean(model));

  it("bloqueia modelo conhecido sem visão e oferece o preset de 1 toque", () => {
    const gate = visionAttachmentGate({
      preferences: { provider: "openrouter", openRouterModel: "texto/barato", openRouterFallbacks: [] },
      catalog,
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.message, VISION_BLOCKED_MESSAGE);
    assert.equal(gate.actionLabel, VISION_ACTION_LABEL);
    assert.equal(gate.choice?.preset, "vision");
    assert.equal(gate.choice?.model, "visao/boa");
  });

  it("deixa passar modelo com visão, desconhecido ou sem catálogo", () => {
    assert.equal(
      visionAttachmentGate({
        preferences: { provider: "openrouter", openRouterModel: "visao/boa", openRouterFallbacks: [] },
        catalog,
      }).allowed,
      true,
    );
    assert.equal(
      visionAttachmentGate({
        preferences: { provider: "openrouter", openRouterModel: "novo/modelo", openRouterFallbacks: [] },
        catalog,
      }).allowed,
      true,
    );
    assert.equal(
      visionAttachmentGate({
        preferences: { provider: "openrouter", openRouterModel: "texto/barato", openRouterFallbacks: [] },
      }).allowed,
      true,
    );
  });

  it("xAI continua aceitando imagem", () => {
    assert.equal(
      visionAttachmentGate({ provider: "xai", openRouterModel: "", openRouterFallbacks: [] }).allowed,
      true,
    );
  });

  it("a ação de 1 toque troca para o preset de visão", () => {
    const result = withVisionPreset(
      { provider: "openrouter", openRouterModel: "texto/barato", openRouterFallbacks: [] },
      catalog,
    );
    assert.equal(result.preferences.openRouterModel, "visao/boa");
    assert.equal(result.preferences.provider, "openrouter");
  });
});

describe("opções de pedido", () => {
  it("normaliza o que vem da UI e preserva a chave em memória", () => {
    assert.deepEqual(
      normalizeAiRequestOptions({
        preferences: { aiProvider: "openrouter", openRouterModel: " a/x " },
        openRouterKey: "  sk-or-abc  ",
      }),
      {
        preferences: { provider: "openrouter", openRouterModel: "a/x", openRouterFallbacks: [] },
        openRouterKey: "sk-or-abc",
      },
    );
  });

  it("aiOptionsFor lê ajustes + chave do cofre", () => {
    const options = aiOptionsFor(
      { aiProvider: "openrouter", openRouterModel: "a/x", openRouterFallbacks: ["b/y"] },
      "sk-or-z",
    );
    assert.equal(options.preferences.provider, "openrouter");
    assert.equal(options.openRouterKey, "sk-or-z");
  });

  it("rótulo da ação de modelo grátis é o combinado", () => {
    assert.equal(FREE_MODEL_ACTION_LABEL, "Usar modelo grátis");
  });
});
