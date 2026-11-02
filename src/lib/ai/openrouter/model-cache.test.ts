import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MODEL_CACHE_KEY,
  MODEL_CACHE_TTL_MS,
  buildModelCache,
  clearModelCache,
  isModelCacheFresh,
  parseModelCache,
  readModelCache,
  writeModelCache,
  type ModelCacheStorage,
} from "./model-cache.ts";
import { normalizeModel, type OpenRouterModel } from "./client.ts";

class MemoryStorage implements ModelCacheStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const model = (id: string): OpenRouterModel => {
  const parsed = normalizeModel({
    id,
    name: id,
    pricing: { prompt: "0", completion: "0" },
    architecture: { input_modalities: ["text"] },
  });
  assert.ok(parsed);
  return parsed;
};

const NOW = Date.parse("2026-11-02T12:00:00Z");

describe("isModelCacheFresh", () => {
  it("vale por 24h e vence no limite", () => {
    const entry = buildModelCache([model("a/x")], NOW);
    assert.equal(isModelCacheFresh(entry, NOW), true);
    assert.equal(isModelCacheFresh(entry, NOW + MODEL_CACHE_TTL_MS - 1), true);
    assert.equal(isModelCacheFresh(entry, NOW + MODEL_CACHE_TTL_MS), false);
  });

  it("trata cache ausente e relógio adiantado como vencido", () => {
    assert.equal(isModelCacheFresh(null, NOW), false);
    const entry = buildModelCache([model("a/x")], NOW);
    assert.equal(isModelCacheFresh(entry, NOW - 1), false);
  });

  it("aceita TTL injetado", () => {
    const entry = buildModelCache([model("a/x")], NOW);
    assert.equal(isModelCacheFresh(entry, NOW + 500, 1000), true);
    assert.equal(isModelCacheFresh(entry, NOW + 1000, 1000), false);
  });
});

describe("parseModelCache", () => {
  it("faz ida e volta pelo JSON", () => {
    const entry = buildModelCache([model("a/x"), model("b/y:free")], NOW);
    const parsed = parseModelCache(JSON.stringify(entry));
    assert.equal(parsed?.fetchedAt, NOW);
    assert.deepEqual(
      parsed?.models.map((item) => item.id),
      ["a/x", "b/y:free"],
    );
    assert.equal(parsed?.models[1]?.free, true);
  });

  it("ignora JSON quebrado, formato errado e lista sem modelo válido", () => {
    assert.equal(parseModelCache("{quebrado"), null);
    assert.equal(parseModelCache("null"), null);
    assert.equal(parseModelCache(JSON.stringify({ fetchedAt: NOW, models: [] })), null);
    assert.equal(parseModelCache(JSON.stringify({ fetchedAt: "ontem", models: [] })), null);
    assert.equal(parseModelCache(JSON.stringify({ models: [{}] })), null);
  });

  it("descarta linhas inválidas dentro de uma lista boa", () => {
    const parsed = parseModelCache({
      fetchedAt: NOW,
      models: [{ id: "a/x" }, { name: "sem id" }, null],
    });
    assert.deepEqual(
      parsed?.models.map((item) => item.id),
      ["a/x"],
    );
  });
});

describe("buildModelCache", () => {
  it("guarda uma cópia (mexer na origem não altera o cache)", () => {
    const list = [model("a/x")];
    const entry = buildModelCache(list, NOW);
    list.push(model("b/y"));
    assert.equal(entry.models.length, 1);
    assert.equal(entry.fetchedAt, NOW);
  });
});

describe("readModelCache / writeModelCache", () => {
  it("lê o que acabou de gravar e expira depois de 24h", () => {
    const storage = new MemoryStorage();
    writeModelCache(storage, [model("a/x")], NOW);
    assert.ok(storage.getItem(MODEL_CACHE_KEY));

    assert.deepEqual(
      readModelCache(storage, NOW + 1000)?.map((item) => item.id),
      ["a/x"],
    );
    assert.equal(readModelCache(storage, NOW + MODEL_CACHE_TTL_MS), null);
  });

  it("ignora cache corrompido em vez de lançar", () => {
    const storage = new MemoryStorage();
    storage.values.set(MODEL_CACHE_KEY, "não é json");
    assert.equal(readModelCache(storage, NOW), null);
  });

  it("armazenamento indisponível não quebra o fluxo", () => {
    const broken: ModelCacheStorage = {
      getItem() {
        throw new Error("cota");
      },
      setItem() {
        throw new Error("cota");
      },
      removeItem() {
        throw new Error("cota");
      },
    };
    assert.equal(readModelCache(broken, NOW), null);
    assert.doesNotThrow(() => writeModelCache(broken, [model("a/x")], NOW));
    assert.doesNotThrow(() => clearModelCache(broken));
  });

  it("clearModelCache remove a entrada", () => {
    const storage = new MemoryStorage();
    writeModelCache(storage, [model("a/x")], NOW);
    clearModelCache(storage);
    assert.equal(storage.getItem(MODEL_CACHE_KEY), null);
  });
});
