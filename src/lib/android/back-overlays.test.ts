import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { closeTopBackOverlay, hasBackOverlay, pushBackOverlay, resetBackOverlays } from "./back-overlays.ts";

describe("pilha de overlays do voltar", () => {
  beforeEach(() => resetBackOverlays());

  it("fecha o overlay mais recente primeiro", () => {
    const closed: string[] = [];
    pushBackOverlay(() => closed.push("professor"));
    pushBackOverlay(() => closed.push("zoom"));

    assert.equal(hasBackOverlay(), true);
    assert.equal(closeTopBackOverlay(), true);
    assert.deepEqual(closed, ["zoom"]);
    assert.equal(closeTopBackOverlay(), true);
    assert.deepEqual(closed, ["zoom", "professor"]);
    assert.equal(hasBackOverlay(), false);
  });

  it("não faz nada quando não há overlay", () => {
    assert.equal(closeTopBackOverlay(), false);
    assert.equal(hasBackOverlay(), false);
  });

  it("remove só o overlay desregistrado, sem afetar os outros", () => {
    const closed: string[] = [];
    const removeA = pushBackOverlay(() => closed.push("a"));
    pushBackOverlay(() => closed.push("b"));

    removeA();
    assert.equal(closeTopBackOverlay(), true);
    assert.deepEqual(closed, ["b"]);
    assert.equal(hasBackOverlay(), false);
  });

  it("cleanup repetido é idempotente", () => {
    const closed: string[] = [];
    const remove = pushBackOverlay(() => closed.push("a"));
    remove();
    remove();
    assert.equal(hasBackOverlay(), false);
    assert.equal(closeTopBackOverlay(), false);
    assert.deepEqual(closed, []);
  });
});
