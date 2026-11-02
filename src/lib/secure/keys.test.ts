import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_KEYS,
  OPENROUTER_KEY_PREFIX,
  clearOpenRouterKey,
  getOpenRouterKey,
  maskKey,
  migrateLegacyKeys,
  normalizeKeys,
  normalizeOpenRouterKey,
  readKey,
  setOpenRouterKey,
  validateOpenRouterKey,
} from "./keys.ts";
import type { KeyName, KeyStorage, LegacyKeyStorage } from "./keys.ts";
import { withoutKeys } from "./redact.ts";

class FakeSecure implements KeyStorage {
  values = new Map<KeyName, string>();
  sets: KeyName[] = [];

  constructor(initial: Partial<Record<KeyName, string>> = {}) {
    for (const [name, value] of Object.entries(initial)) {
      if (typeof value === "string") this.values.set(name as KeyName, value);
    }
  }

  async get(name: KeyName): Promise<string | null> {
    return this.values.get(name) ?? null;
  }

  async set(name: KeyName, value: string): Promise<void> {
    this.sets.push(name);
    this.values.set(name, value);
  }

  async remove(name: KeyName): Promise<void> {
    this.values.delete(name);
  }
}

class FakeLegacy implements LegacyKeyStorage {
  values: Partial<Record<KeyName, string>>;
  removed: KeyName[] = [];
  reads = 0;

  constructor(values: Partial<Record<KeyName, string>> = {}) {
    this.values = { ...values };
  }

  async read(): Promise<Partial<Record<KeyName, string>>> {
    this.reads += 1;
    return { ...this.values };
  }

  async remove(names: readonly KeyName[]): Promise<void> {
    this.removed.push(...names);
    for (const name of names) delete this.values[name];
  }
}

class BrokenSecure extends FakeSecure {
  async set(): Promise<void> {
    throw new Error("Keystore indisponível");
  }
}

class CorruptSecure extends FakeSecure {
  removals: KeyName[] = [];

  async get(name: KeyName): Promise<string | null> {
    if (name === "xai") throw new Error("Falha ao decifrar a chave do Keystore");
    return super.get(name);
  }

  async remove(name: KeyName): Promise<void> {
    this.removals.push(name);
    await super.remove(name);
  }
}

describe("readKey com Keystore invalidado", () => {
  it("trata a entrada ilegível como Não configurada e apaga só ela", async () => {
    const secure = new CorruptSecure({ xai: "chave-corrompida", gemini: "chave-boa" });

    assert.deepEqual(await readKey(secure, "xai"), { value: "", recovered: true });
    assert.deepEqual(secure.removals, ["xai"]);
    assert.equal(await secure.get("gemini"), "chave-boa");
  });

  it("apaga a entrada mesmo quando o próprio remove falha, sem lançar", async () => {
    const secure = new CorruptSecure();
    secure.remove = async () => {
      throw new Error("Keystore indisponível");
    };

    assert.deepEqual(await readKey(secure, "xai"), { value: "", recovered: true });
  });

  it("leitura normal continua devolvendo a chave sem apagar nada", async () => {
    const secure = new FakeSecure({ xai: "  xai-key  " });

    assert.deepEqual(await readKey(secure, "xai"), { value: "xai-key", recovered: false });
    assert.equal(await secure.get("xai"), "  xai-key  ");
  });
});

describe("migrateLegacyKeys", () => {
  it("move as chaves preenchidas para o cofre e apaga do IndexedDB", async () => {
    const secure = new FakeSecure();
    const legacy = new FakeLegacy({
      xai: "  xai-key  ",
      perplexity: "pplx-key",
      gemini: "   ",
      claude: "claude-key",
    });

    const moved = await migrateLegacyKeys(secure, legacy);

    assert.deepEqual(moved, ["xai", "perplexity", "claude"]);
    assert.equal(await secure.get("xai"), "xai-key");
    assert.equal(await secure.get("perplexity"), "pplx-key");
    assert.equal(await secure.get("claude"), "claude-key");
    assert.equal(await secure.get("gemini"), null);
    assert.deepEqual(legacy.removed, ["xai", "perplexity", "gemini", "claude"]);
    assert.deepEqual(legacy.values, {});
  });

  it("preserva a chave que já está no cofre e só remove a cópia antiga", async () => {
    const secure = new FakeSecure({ xai: "chave-nova" });
    const legacy = new FakeLegacy({ xai: "chave-antiga" });

    const moved = await migrateLegacyKeys(secure, legacy);

    assert.deepEqual(moved, ["xai"]);
    assert.equal(await secure.get("xai"), "chave-nova");
    assert.deepEqual(legacy.values, {});
    assert.equal(secure.sets.length, 0);
  });

  it("é idempotente: a segunda execução não grava nem apaga nada", async () => {
    const secure = new FakeSecure();
    const legacy = new FakeLegacy({ xai: "xai-key" });

    await migrateLegacyKeys(secure, legacy);
    const writes = secure.sets.length;
    const removals = legacy.removed.length;

    const movedAgain = await migrateLegacyKeys(secure, legacy);

    assert.deepEqual(movedAgain, []);
    assert.equal(secure.sets.length, writes);
    assert.equal(legacy.removed.length, removals);
  });

  it("ignora chaves vazias no cofre e limpa o campo antigo do IndexedDB", async () => {
    const secure = new FakeSecure();
    const legacy = new FakeLegacy({ xai: "", perplexity: "   ", gemini: undefined });

    const moved = await migrateLegacyKeys(secure, legacy);

    assert.deepEqual(moved, []);
    assert.equal(secure.sets.length, 0);
    assert.deepEqual(legacy.removed, ["xai", "perplexity", "gemini"]);
    assert.deepEqual(legacy.values, {});
  });

  it("não apaga a chave antiga se o cofre falhar antes da limpeza", async () => {
    const secure = new BrokenSecure();
    const legacy = new FakeLegacy({ xai: "xai-key" });

    await assert.rejects(() => migrateLegacyKeys(secure, legacy), /Keystore/);

    assert.deepEqual(legacy.values, { xai: "xai-key" });
    assert.deepEqual(legacy.removed, []);
  });
});

describe("normalizeKeys", () => {
  it("preenche as cinco chaves e descarta valores que não são texto", () => {
    assert.deepEqual(normalizeKeys({ xai: " ab ", perplexity: 42, gemini: null }), {
      ...EMPTY_KEYS,
      xai: "ab",
    });
    assert.deepEqual(normalizeKeys(undefined), EMPTY_KEYS);
  });
});

describe("withoutKeys (backup)", () => {
  it("remove o campo keys dos ajustes exportados", () => {
    const settings = { studyHour: 7, keys: { xai: "segredo" } };
    const safe = withoutKeys(settings);
    assert.deepEqual(safe, { studyHour: 7 });
    assert.equal("keys" in safe, false);
  });
});

describe("maskKey", () => {
  it("mostra o prefixo do OpenRouter e só os últimos 4 caracteres", () => {
    const masked = maskKey("sk-or-v1-0123456789abcdef");
    assert.equal(masked, "sk-or-…cdef");
    assert.doesNotMatch(masked, /0123456789ab/);
  });

  it("mantém um prefixo curto para as outras chaves", () => {
    assert.equal(maskKey("  xai-abcdefghijkl  "), "xai-…ijkl");
  });

  it("não revela nada de chave vazia ou muito curta", () => {
    assert.equal(maskKey(""), "");
    assert.equal(maskKey("abc"), "…");
    assert.equal(maskKey("abcdef"), "…cdef");
  });
});

describe("chave do OpenRouter", () => {
  it("limpa as pontas e exige o prefixo sk-or-", () => {
    assert.equal(normalizeOpenRouterKey("  sk-or-v1-abc  "), "sk-or-v1-abc");
    assert.equal(normalizeOpenRouterKey(null), "");

    assert.deepEqual(validateOpenRouterKey("  sk-or-v1-abc  "), {
      ok: true,
      value: "sk-or-v1-abc",
    });
    assert.equal(validateOpenRouterKey("").ok, false);
    assert.equal(validateOpenRouterKey("   ").ok, false);
    assert.equal(validateOpenRouterKey("xai-abc").ok, false);
    assert.equal(validateOpenRouterKey(`${OPENROUTER_KEY_PREFIX} `).ok, false);
  });

  it("grava, lê e remove no mesmo cofre da xAI, com nome próprio", async () => {
    const secure = new FakeSecure({ xai: "xai-key" });

    await setOpenRouterKey("  sk-or-v1-abc  ", secure);
    assert.equal(await secure.get("openrouter"), "sk-or-v1-abc");
    assert.equal(await getOpenRouterKey(secure), "sk-or-v1-abc");

    await clearOpenRouterKey(secure);
    assert.equal(await secure.get("openrouter"), null);
    assert.equal(await secure.get("xai"), "xai-key");
  });

  it("recusa chave fora do formato antes de tocar no cofre", async () => {
    const secure = new FakeSecure();
    await assert.rejects(() => setOpenRouterKey("chave-qualquer", secure), /começa com sk-or-/);
    assert.equal(secure.sets.length, 0);
    assert.equal(await secure.get("openrouter"), null);
  });
});
