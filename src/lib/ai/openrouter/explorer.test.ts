import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OpenRouterModel } from "./client.ts";
import {
  DEFAULT_EXPLORER_FILTERS,
  contextLabel,
  exploreModels,
  filterModels,
  normalizeSearchQuery,
  presetForModel,
  priceLabel,
  sortModels,
  validateManualModelId,
} from "./explorer.ts";

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
  model(id, { supportsImages: true, inputModalities: ["text", "image"], ...extra });

const CATALOG = [
  model("zebra/pago-caro", { pricing: { promptPerMillion: 10, completionPerMillion: 20 } }),
  free("meta/llama:free", { name: "Llama Grátis" }),
  vision("google/gemini", {
    name: "Gemini Flash",
    pricing: { promptPerMillion: 0.3, completionPerMillion: 2.5 },
    contextLength: 1_000_000,
  }),
  model("sem/preco", { pricing: { promptPerMillion: null, completionPerMillion: null } }),
  free("visao/gratis", {
    name: "Visão gratuita",
    supportsImages: true,
    inputModalities: ["text", "image"],
  }),
];

describe("normalizeSearchQuery", () => {
  it("ignora maiúsculas, acentos e espaços repetidos", () => {
    assert.equal(normalizeSearchQuery("  Visão   GRÁTIS "), "visao gratis");
    assert.equal(normalizeSearchQuery(""), "");
  });
});

describe("filterModels", () => {
  it("busca por nome ou id sem diferenciar maiúsculas", () => {
    const byName = filterModels(CATALOG, { ...DEFAULT_EXPLORER_FILTERS, query: "gemini" });
    assert.deepEqual(
      byName.map((item) => item.id),
      ["google/gemini"],
    );
    const byId = filterModels(CATALOG, { ...DEFAULT_EXPLORER_FILTERS, query: "META/" });
    assert.deepEqual(
      byId.map((item) => item.id),
      ["meta/llama:free"],
    );
  });

  it("o chip Grátis usa o mesmo critério do catálogo", () => {
    const list = filterModels(CATALOG, { ...DEFAULT_EXPLORER_FILTERS, freeOnly: true });
    assert.deepEqual(
      list.map((item) => item.id),
      ["meta/llama:free", "visao/gratis"],
    );
  });

  it("o chip Lê imagens filtra por input_modalities", () => {
    const list = filterModels(CATALOG, { ...DEFAULT_EXPLORER_FILTERS, visionOnly: true });
    assert.deepEqual(
      list.map((item) => item.id),
      ["google/gemini", "visao/gratis"],
    );
  });

  it("chips cumulativos exigem os dois critérios", () => {
    const list = filterModels(CATALOG, {
      ...DEFAULT_EXPLORER_FILTERS,
      freeOnly: true,
      visionOnly: true,
    });
    assert.deepEqual(
      list.map((item) => item.id),
      ["visao/gratis"],
    );
  });

  it("busca vazia devolve tudo", () => {
    assert.equal(filterModels(CATALOG, DEFAULT_EXPLORER_FILTERS).length, CATALOG.length);
  });
});

describe("sortModels / exploreModels", () => {
  it("menor preço coloca grátis primeiro e preço desconhecido no fim", () => {
    const list = sortModels(CATALOG, "price-asc");
    assert.deepEqual(
      list.map((item) => item.id),
      ["meta/llama:free", "visao/gratis", "google/gemini", "zebra/pago-caro", "sem/preco"],
    );
  });

  it("maior preço mantém preço desconhecido no fim", () => {
    const list = sortModels(CATALOG, "price-desc");
    assert.equal(list[0]?.id, "zebra/pago-caro");
    assert.equal(list.at(-1)?.id, "sem/preco");
  });

  it("relevância não altera a ordem original e não muda a lista recebida", () => {
    const copy = CATALOG.slice();
    assert.deepEqual(
      sortModels(CATALOG, "relevance").map((item) => item.id),
      copy.map((item) => item.id),
    );
    assert.deepEqual(
      CATALOG.map((item) => item.id),
      copy.map((item) => item.id),
    );
  });

  it("explora filtrando e ordenando juntos", () => {
    const list = exploreModels(CATALOG, {
      query: "g",
      freeOnly: false,
      visionOnly: true,
      sort: "price-asc",
    });
    assert.deepEqual(
      list.map((item) => item.id),
      ["visao/gratis", "google/gemini"],
    );
  });
});

describe("priceLabel / contextLabel", () => {
  it("mostra Grátis, preço por milhão e preço ausente", () => {
    assert.equal(priceLabel(free("a/b")), "Grátis");
    assert.equal(
      priceLabel(model("a/b", { pricing: { promptPerMillion: 0.3, completionPerMillion: 2.5 } })),
      "Entrada $0.3 · Saída $2.5",
    );
    assert.equal(
      priceLabel(model("a/b", { pricing: { promptPerMillion: 2, completionPerMillion: 2 } })),
      "$2 / 1M",
    );
    assert.equal(
      priceLabel(
        model("a/b", { pricing: { promptPerMillion: null, completionPerMillion: null } }),
      ),
      "Preço não informado",
    );
  });

  it("contexto grande vira milhares e vazio não inventa unidade", () => {
    assert.equal(contextLabel(model("a/b", { contextLength: 1_000_000 })), "1M tokens");
    assert.equal(contextLabel(model("a/b", { contextLength: 128_000 })), "128 mil tokens");
    assert.equal(contextLabel(model("a/b", { contextLength: 512 })), "512 tokens");
    assert.equal(contextLabel(model("a/b", { contextLength: null })), "");
  });
});

describe("validateManualModelId", () => {
  it("aceita autor/modelo, sufixo :free e openrouter/auto", () => {
    assert.deepEqual(validateManualModelId("  anthropic/claude-3.5-sonnet  "), {
      ok: true,
      value: "anthropic/claude-3.5-sonnet",
    });
    assert.deepEqual(validateManualModelId("meta/llama:free"), {
      ok: true,
      value: "meta/llama:free",
    });
    assert.deepEqual(validateManualModelId("openrouter/auto"), {
      ok: true,
      value: "openrouter/auto",
    });
  });

  it("recusa vazio, espaços, sem barra e barra solta", () => {
    for (const value of ["", "   ", "modelo", "a b/c", "/modelo", "modelo/", "a//b", 42, null]) {
      assert.equal(validateManualModelId(value).ok, false, String(value));
    }
  });
});

describe("presetForModel", () => {
  it("reconhece o roteador automático sem catálogo", () => {
    assert.equal(presetForModel("openrouter/auto", []), "value");
    assert.equal(presetForModel("", []), null);
  });

  it("marca o preset que resolveria o modelo salvo", () => {
    assert.equal(presetForModel("meta/llama:free", CATALOG), "fast-free");
    assert.equal(presetForModel("google/gemini", CATALOG), "vision");
    assert.equal(presetForModel("outro/modelo", CATALOG), null);
  });
});
