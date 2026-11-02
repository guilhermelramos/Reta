import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ensurePersistentStorage, shouldRequestPersist } from "./storage.ts";
import type { PersistStorage } from "./storage.ts";

function fakeStorage(input: {
  persisted?: boolean | null | (() => Promise<boolean>);
  persistResult?: boolean;
  persistThrows?: boolean;
  persistedThrows?: boolean;
}) {
  let persistCalls = 0;
  const storage: PersistStorage = {
    async persisted() {
      if (input.persistedThrows) throw new Error("sem permissão");
      if (typeof input.persisted === "function") return input.persisted();
      return input.persisted ?? false;
    },
    async persist() {
      persistCalls += 1;
      if (input.persistThrows) throw new Error("negado");
      return input.persistResult ?? true;
    },
  };
  return { storage, calls: () => persistCalls };
}

describe("pedido de armazenamento persistente", () => {
  it("pede quando a API existe e o estado ainda não é persistente", () => {
    assert.equal(shouldRequestPersist({ persist: async () => true }, false), true);
    assert.equal(shouldRequestPersist({ persist: async () => true }, null), true);
  });

  it("não repete o pedido quando já é persistente", () => {
    assert.equal(shouldRequestPersist({ persist: async () => true }, true), false);
  });

  it("não pede sem a API", () => {
    assert.equal(shouldRequestPersist(null, false), false);
    assert.equal(shouldRequestPersist(undefined, false), false);
    assert.equal(shouldRequestPersist({}, false), false);
  });
});

describe("ensurePersistentStorage", () => {
  it("chama persist() uma vez e devolve o resultado", async () => {
    const fake = fakeStorage({ persisted: false, persistResult: true });
    assert.equal(await ensurePersistentStorage(fake.storage), true);
    assert.equal(fake.calls(), 1);
  });

  it("não chama persist() quando o navegador já concedeu", async () => {
    const fake = fakeStorage({ persisted: true });
    assert.equal(await ensurePersistentStorage(fake.storage), true);
    assert.equal(fake.calls(), 0);
  });

  it("erro no pedido não escapa e mantém a gravação funcionando", async () => {
    const fake = fakeStorage({ persisted: false, persistThrows: true });
    assert.equal(await ensurePersistentStorage(fake.storage), false);
  });

  it("erro ao ler o estado ainda tenta o pedido", async () => {
    const fake = fakeStorage({ persisted: false, persistedThrows: true });
    assert.equal(await ensurePersistentStorage(fake.storage), true);
    assert.equal(fake.calls(), 1);
  });

  it("ambiente sem a API devolve false", async () => {
    assert.equal(await ensurePersistentStorage(null), false);
  });
});
