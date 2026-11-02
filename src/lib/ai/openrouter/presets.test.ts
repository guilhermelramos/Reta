import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OPENROUTER_AUTO_MODEL, type OpenRouterModel } from "./client.ts";
import {
  DEFAULT_STUDY_PRESET,
  STUDY_PRESETS,
  firstFreeModel,
  isStudyPresetId,
  resolvePreset,
  studyPreset,
  visionModels,
} from "./presets.ts";

function model(id: string, extra: Partial<OpenRouterModel> = {}): OpenRouterModel {
  return {
    id,
    name: id,
    free: false,
    supportsImages: false,
    contextLength: 8192,
    pricing: { promptPerMillion: 1, completionPerMillion: 2 },
    inputModalities: ["text"],
    outputModalities: ["text"],
    ...extra,
  };
}

const free = (id: string, extra: Partial<OpenRouterModel> = {}) =>
  model(id, { free: true, pricing: { promptPerMillion: 0, completionPerMillion: 0 }, ...extra });

const vision = (id: string, extra: Partial<OpenRouterModel> = {}) =>
  model(id, {
    supportsImages: true,
    inputModalities: ["text", "image"],
    ...extra,
  });

describe("catálogo de presets", () => {
  it("tem os três presets pedidos, com rótulos em português", () => {
    assert.deepEqual(
      STUDY_PRESETS.map((preset) => preset.id),
      ["fast-free", "value", "vision"],
    );
    assert.deepEqual(
      STUDY_PRESETS.map((preset) => preset.label),
      ["Rápido e grátis", "Custo-benefício", "Lê fotos"],
    );
    assert.equal(studyPreset(DEFAULT_STUDY_PRESET).id, "fast-free");
  });

  it("reconhece só ids conhecidos", () => {
    assert.equal(isStudyPresetId("vision"), true);
    assert.equal(isStudyPresetId("turbo"), false);
  });
});

describe("firstFreeModel", () => {
  it("prioriza o sufixo :free documentado", () => {
    const list = [free("exemplo/sem-sufixo"), free("exemplo/com-sufixo:free")];
    assert.equal(firstFreeModel(list)?.id, "exemplo/com-sufixo:free");
  });

  it("aceita preço zerado quando não há :free", () => {
    const list = [model("pago/x"), free("exemplo/zero")];
    assert.equal(firstFreeModel(list)?.id, "exemplo/zero");
  });

  it("devolve null quando tudo é pago", () => {
    assert.equal(firstFreeModel([model("pago/x")]), null);
  });
});

describe("resolvePreset", () => {
  it("'Custo-benefício' usa o roteador automático", () => {
    assert.deepEqual(resolvePreset("value", []), {
      preset: "value",
      model: OPENROUTER_AUTO_MODEL,
      fallbacks: [],
    });
  });

  it("'Rápido e grátis' usa o primeiro modelo grátis e cai no automático", () => {
    const list = [model("pago/x"), free("a/primeiro:free"), free("b/segundo:free")];
    assert.deepEqual(resolvePreset("fast-free", list), {
      preset: "fast-free",
      model: "a/primeiro:free",
      fallbacks: [OPENROUTER_AUTO_MODEL],
    });
  });

  it("'Rápido e grátis' devolve null sem modelo grátis", () => {
    assert.equal(resolvePreset("fast-free", [model("pago/x")]), null);
  });

  it("'Lê fotos' escolhe o modelo com visão de maior contexto", () => {
    const list = [
      model("sem/visao", { contextLength: 1_000_000 }),
      vision("visao/curto", { contextLength: 32_000 }),
      vision("visao/longo", { contextLength: 1_000_000 }),
      vision("visao/medio", { contextLength: 128_000 }),
    ];
    assert.deepEqual(resolvePreset("vision", list), {
      preset: "vision",
      model: "visao/longo",
      fallbacks: ["visao/medio", "visao/curto"],
    });
  });

  it("'Lê fotos' desempata contexto pelo preço e depois pelo id", () => {
    const barato = vision("visao/a", {
      contextLength: 32_000,
      pricing: { promptPerMillion: 1, completionPerMillion: 1 },
    });
    const caro = vision("visao/b", {
      contextLength: 32_000,
      pricing: { promptPerMillion: 5, completionPerMillion: 5 },
    });
    assert.equal(visionModels([barato, caro])[0]?.id, "visao/b");
  });

  it("'Lê fotos' devolve null quando nenhum modelo aceita imagem", () => {
    assert.equal(resolvePreset("vision", [model("a/x"), model("b/y")]), null);
  });

  it("não repete o principal nos fallbacks", () => {
    const choice = resolvePreset("vision", [vision("unico/modelo")]);
    assert.deepEqual(choice, { preset: "vision", model: "unico/modelo", fallbacks: [] });
  });
});
