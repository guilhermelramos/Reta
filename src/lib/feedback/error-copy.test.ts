import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AiRequestError } from "../ai/errors.ts";
import {
  BLOCK_MISSING_MESSAGE,
  INVALID_KEY_MESSAGE,
  NOTIFICATIONS_DENIED_MESSAGE,
  OFFLINE_MESSAGE,
  RATE_LIMIT_MESSAGE,
  SHEET_MESSAGE,
  blockMissingCopy,
  describeError,
  notificationsDeniedCopy,
  rateLimitCopy,
  sheetErrorCopy,
  sheetProblemFromWarning,
} from "./error-copy.ts";

describe("describeError — erros de IA", () => {
  it("sem internet usa o texto e o retry exatos", () => {
    const copy = describeError(new Error("qualquer"), { online: false });
    assert.equal(copy.kind, "offline");
    assert.equal(copy.message, OFFLINE_MESSAGE);
    assert.equal(copy.message, "Você está offline. Pacotes baixados continuam funcionando.");
    assert.equal(copy.action?.id, "retry");
    assert.equal(copy.action?.label, "Tentar de novo");
    assert.equal(copy.action?.retryAfterSeconds, undefined);
  });

  it("erro de transporte offline também cai no texto de offline", () => {
    const copy = describeError(new AiRequestError("falhou", "offline"));
    assert.equal(copy.message, OFFLINE_MESSAGE);
  });

  it("429 usa a frase exata e respeita o Retry-After", () => {
    const withHeader = describeError(
      new AiRequestError("Limite", "rate-limit", { status: 429, retryAfterSeconds: 7 }),
    );
    assert.equal(withHeader.message, RATE_LIMIT_MESSAGE);
    assert.equal(withHeader.message, "Muitas perguntas seguidas. Aguarde ~1 min.");
    assert.equal(withHeader.action?.id, "retry");
    assert.equal(withHeader.action?.retryAfterSeconds, 7);

    const withoutHeader = describeError(
      new AiRequestError("Limite", "rate-limit", { status: 429 }),
    );
    assert.equal(withoutHeader.action?.retryAfterSeconds, 60);
  });

  it("considera status 429 mesmo sem kind", () => {
    const copy = describeError({ status: 429, message: "slow down", retryAfterSeconds: 3 });
    assert.equal(copy.kind, "rate-limit");
    assert.equal(copy.action?.retryAfterSeconds, 3);
  });

  it("401/403 viram chave inválida com ação para Ajustes", () => {
    for (const status of [401, 403]) {
      const copy = describeError(new AiRequestError("recusada", "unauthorized", { status }));
      assert.equal(copy.kind, "unauthorized");
      assert.equal(copy.message, INVALID_KEY_MESSAGE);
      assert.equal(copy.message, "Chave xAI inválida.");
      assert.equal(copy.action?.id, "update-key");
      assert.equal(copy.action?.label, "Atualizar chave");
      assert.equal(copy.action?.href, "/ajustes");
    }
  });

  it("chave ausente também leva para Ajustes", () => {
    const copy = describeError(
      new AiRequestError("Sem chave da xAI. Cole a sua chave em Ajustes.", "missing-key"),
    );
    assert.equal(copy.kind, "missing-key");
    assert.equal(copy.action?.href, "/ajustes");
  });

  it("timeout devolve retry", () => {
    const copy = describeError(new AiRequestError("demorou", "timeout"));
    assert.equal(copy.kind, "timeout");
    assert.equal(copy.action?.id, "retry");
  });
});

describe("describeError — casos de tela", () => {
  it("permissão de notificação negada", () => {
    const copy = describeError(null, { notifications: "denied" });
    assert.equal(copy.kind, "notifications");
    assert.equal(
      copy.message,
      "Lembretes desativados. Você não vai receber aviso do timer.",
    );
    assert.equal(copy.message, NOTIFICATIONS_DENIED_MESSAGE);
    assert.equal(copy.action?.id, "open-settings");
    assert.equal(copy.action?.label, "Abrir configurações");
  });

  it("navegador sem Notification cai no mesmo aviso", () => {
    assert.equal(notificationsDeniedCopy().message, NOTIFICATIONS_DENIED_MESSAGE);
  });

  it("bloco inexistente tem a frase e a ação do plano", () => {
    const copy = describeError(null, { blockMissing: true });
    assert.equal(copy.kind, "block");
    assert.equal(
      copy.message,
      "Esse bloco não existe mais no seu plano (talvez a planilha tenha mudado).",
    );
    assert.equal(copy.message, BLOCK_MISSING_MESSAGE);
    assert.equal(copy.action?.label, "Ver plano de hoje");
    assert.equal(copy.action?.href, "/");
    assert.equal(blockMissingCopy().kind, "block");
  });

  it("planilha sem colunas mostra os dois caminhos", () => {
    const copy = sheetErrorCopy();
    assert.equal(copy.kind, "sheet");
    assert.equal(
      copy.message,
      "Não encontramos as colunas Data, Bloco A, Bloco B e Revisão.",
    );
    assert.equal(copy.message, SHEET_MESSAGE);
    assert.equal(copy.action?.id, "choose-file");
    assert.equal(copy.action?.label, "Escolher outro arquivo");
    assert.equal(copy.secondaryAction?.id, "download-template");
    assert.equal(copy.secondaryAction?.label, "Baixar modelo");
  });

  it("lista a linha e a coluna do problema", () => {
    const copy = sheetErrorCopy({
      row: 4,
      column: "Data",
      reason: "Data inválida",
      missingColumns: ["Data"],
    });
    assert.match(copy.detail ?? "", /Linha 4, coluna Data: Data inválida\./);
    assert.match(copy.detail ?? "", /Faltam: Data\./);
  });

  it("traduz o aviso do parser em coluna", () => {
    assert.deepEqual(sheetProblemFromWarning({ row: 9, message: "Data inválida — linha ignorada." }), {
      row: 9,
      column: "Data",
      reason: "Data inválida",
    });
    assert.equal(
      sheetProblemFromWarning({ row: 2, message: 'Tempo do bloco A ilegível ("xx"). Usei 0.' }).column,
      "Min A",
    );
    assert.equal(
      sheetProblemFromWarning({ row: 3, message: "2026-03-02: sem conteúdo A, B ou revisão." }).column,
      "Bloco A",
    );
  });
});

describe("describeError — textos já traduzidos", () => {
  it("preserva a mensagem local", () => {
    const copy = describeError(new Error("A resposta não veio em JSON."));
    assert.equal(copy.message, "A resposta não veio em JSON.");
    assert.equal(copy.action?.id, "retry");
  });

  it("reconhece mensagens antigas do cliente", () => {
    assert.equal(describeError("Sem internet. Conecte-se e tente de novo.").kind, "offline");
    assert.equal(describeError("Limite de uso da API atingido.").kind, "rate-limit");
    assert.equal(describeError("A chave da xAI foi recusada.").kind, "unauthorized");
    assert.equal(describeError("Sem chave da xAI. Cole a sua chave em Ajustes.").kind, "missing-key");
  });

  it("429 default mantém a contagem de um minuto", () => {
    assert.equal(rateLimitCopy().action?.retryAfterSeconds, 60);
  });
});
