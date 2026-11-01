import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AiRequestError,
  NETWORK_MESSAGE,
  OFFLINE_MESSAGE,
  TIMEOUT_MESSAGE,
  failureOf,
  httpError,
  mapFailure,
  retryAfterSeconds,
  transportFailure,
} from "./errors.ts";

describe("retryAfterSeconds", () => {
  it("aceita segundos", () => {
    assert.equal(retryAfterSeconds("12"), 12);
    assert.equal(retryAfterSeconds(3.2), 4);
  });

  it("aceita data HTTP relativa a agora", () => {
    const now = Date.parse("2026-11-01T12:00:00Z");
    assert.equal(retryAfterSeconds("Sun, 01 Nov 2026 12:00:30 GMT", now), 30);
    assert.equal(retryAfterSeconds("Sun, 01 Nov 2026 11:59:00 GMT", now), 0);
  });

  it("ignora valor inválido", () => {
    assert.equal(retryAfterSeconds("daqui a poco"), null);
    assert.equal(retryAfterSeconds(""), null);
    assert.equal(retryAfterSeconds(null), null);
  });
});

describe("httpError", () => {
  it("401/403 viram chave recusada", () => {
    const auth = httpError(401);
    assert.equal(auth.kind, "unauthorized");
    assert.match(auth.message, /chave da xAI foi recusada/i);
    assert.match(auth.message, /Ajustes/);

    const forbidden = httpError(403, "", { providerLabel: "Perplexity" });
    assert.match(forbidden.message, /Perplexity/);
  });

  it("429 respeita o Retry-After", () => {
    const limited = httpError(429, "", { retryAfter: "7" });
    assert.equal(limited.kind, "rate-limit");
    assert.equal(limited.retryAfterSeconds, 7);
    assert.match(limited.message, /7 s/);

    const withoutHeader = httpError(429);
    assert.match(withoutHeader.message, /Espere um pouco/);
  });

  it("5xx vira indisponível e 408 vira timeout", () => {
    const server = httpError(503);
    assert.equal(server.kind, "server");
    assert.match(server.message, /indisponível/);
    assert.match(server.message, /503/);

    assert.equal(httpError(504).kind, "timeout");
    assert.equal(httpError(408).kind, "timeout");
  });

  it("400 mostra o motivo sem vazar chave/token", () => {
    const bad = httpError(400, "invalid api key sk-abcdefghijklmnopqrstuvwxyz012345");
    assert.equal(bad.kind, "bad-request");
    assert.match(bad.message, /erro 400/);
    assert.doesNotMatch(bad.message, /abcdefghijklmnopqrstuvwxyz012345/);
    assert.match(bad.message, /•••/);
  });
});

describe("mapFailure", () => {
  it("preserva a mensagem já traduzida", () => {
    const error = new AiRequestError("Limite de uso da API atingido.", "rate-limit");
    assert.equal(mapFailure(error), "Limite de uso da API atingido.");
  });

  it("traduz timeout", () => {
    assert.equal(mapFailure(new Error("The operation timed out")), TIMEOUT_MESSAGE);
    assert.equal(mapFailure(new DOMException("aborted", "AbortError")), TIMEOUT_MESSAGE);
  });

  it("traduz falha de rede e navigator.onLine falso", () => {
    assert.equal(mapFailure(new Error("Failed to fetch")), NETWORK_MESSAGE);
    assert.equal(mapFailure(new Error("qualquer coisa"), { online: false }), OFFLINE_MESSAGE);
  });

  it("não esconde mensagens locais em português", () => {
    assert.equal(
      mapFailure(new Error("A resposta não veio em JSON.")),
      "A resposta não veio em JSON.",
    );
  });
});

describe("failureOf", () => {
  it("preserva a chave do erro para a UI escolher a ação", () => {
    const limited = failureOf(httpError(429, "", { retryAfter: "9" }));
    assert.equal(limited.kind, "rate-limit");
    assert.equal(limited.status, 429);
    assert.equal(limited.retryAfterSeconds, 9);

    const denied = failureOf(new AiRequestError("x", "unauthorized", { status: 403 }));
    assert.equal(denied.kind, "unauthorized");
    assert.equal(denied.status, 403);
  });

  it("classifica falha crua de rede como offline", () => {
    const failure = failureOf(new Error("Failed to fetch"), { online: false });
    assert.equal(failure.kind, "offline");
    assert.equal(failure.message, OFFLINE_MESSAGE);
  });
});

describe("transportFailure", () => {
  it("classifica offline, timeout e rede", () => {
    const offline = transportFailure(new Error("falhou"), { online: false });
    assert.equal(offline.kind, "offline");
    assert.equal(offline.message, OFFLINE_MESSAGE);

    const timeout = transportFailure(new Error("Request timed out"));
    assert.equal(timeout.kind, "timeout");
    assert.equal(timeout.message, TIMEOUT_MESSAGE);

    const network = transportFailure(new Error("Load failed"));
    assert.equal(network.kind, "offline");
    assert.equal(network.message, NETWORK_MESSAGE);
  });

  it("não remapeia um erro já traduzido", () => {
    const original = new AiRequestError("A IA recusou o pedido (erro 400).", "bad-request");
    assert.equal(transportFailure(original), original);
  });
});
