import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultTransport, webHeaders } from "./transport.ts";

describe("webHeaders", () => {
  it("remove o HTTP-Referer proibido pelo fetch da WebView", () => {
    const headers = {
      Authorization: "Bearer sk-or-v1-teste",
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/guilhermelramos/Reta",
      Referer: "https://github.com/guilhermelramos/Reta",
      "X-Title": "Reta",
    };

    assert.deepEqual(webHeaders(headers), {
      Authorization: "Bearer sk-or-v1-teste",
      "Content-Type": "application/json",
      "X-Title": "Reta",
    });
  });

  it("não altera o objeto original e aceita nomes em minúsculas", () => {
    const original = { "http-referer": "x", "x-title": "Reta" };
    assert.deepEqual(webHeaders(original), { "x-title": "Reta" });
    assert.deepEqual(original, { "http-referer": "x", "x-title": "Reta" });
  });
});

describe("defaultTransport", () => {
  it("na web (Node) devolve um transporte chamável", () => {
    assert.equal(typeof defaultTransport(), "function");
  });
});
