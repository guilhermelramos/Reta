import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NOTIFICATIONS_DENIED_MESSAGE } from "../feedback/error-copy.ts";
import {
  appVersionLabel,
  batteryStatus,
  exactAlarmStatus,
  keySaveLabel,
  keyStatus,
  remindersStatus,
  storageStatus,
  testConnectionLabel,
  testConnectionMessage,
} from "./settings-status.ts";

describe("status da chave xAI", () => {
  it("chave preenchida mostra Conectada", () => {
    const status = keyStatus("xai-abc123");
    assert.equal(status.configured, true);
    assert.equal(status.label, "Conectada");
    assert.equal(status.tone, "ok");
  });

  it("campo vazio ou só com espaços mostra Não configurada", () => {
    for (const value of ["", "   ", "\n\t"]) {
      const status = keyStatus(value);
      assert.equal(status.configured, false);
      assert.equal(status.label, "Não configurada");
      assert.equal(status.tone, "muted");
    }
  });

  it("o botão pede Salvar quando não há chave e Atualizar quando já há", () => {
    assert.equal(keySaveLabel(false), "Salvar chave");
    assert.equal(keySaveLabel(true), "Atualizar chave");
  });
});

describe("status dos lembretes", () => {
  it("permissão concedida no Android fala do agendamento no aparelho", () => {
    const status = remindersStatus("granted", true);
    assert.equal(status.label, "Ativadas");
    assert.equal(status.tone, "ok");
    assert.match(status.hint, /próprio aparelho/);
  });

  it("permissão concedida na web fala da aba aberta", () => {
    const status = remindersStatus("granted", false);
    assert.equal(status.label, "Ativadas");
    assert.match(status.hint, /Reta aberto/);
  });

  it("permissão negada usa o texto padronizado de feedback", () => {
    const status = remindersStatus("denied", true);
    assert.equal(status.label, "Bloqueadas");
    assert.equal(status.tone, "warn");
    assert.equal(status.hint, NOTIFICATIONS_DENIED_MESSAGE);
    assert.equal(
      status.hint,
      "Lembretes desativados. Você não vai receber aviso do timer.",
    );
  });

  it("pedido ainda não feito e ambiente sem suporte têm rótulos próprios", () => {
    assert.equal(remindersStatus("default", false).label, "Não ativadas");
    assert.equal(remindersStatus("unsupported", true).label, "Indisponível");
    assert.equal(remindersStatus("unsupported", false).label, "Indisponível");
  });
});

describe("status do alarme exato", () => {
  it("autorizado não abre configurações", () => {
    const status = exactAlarmStatus("granted", true);
    assert.equal(status.label, "Autorizado");
    assert.equal(status.opensSettings, false);
    assert.equal(status.tone, "ok");
  });

  it("negado abre configurações e avisa do atraso", () => {
    const status = exactAlarmStatus("denied", true);
    assert.equal(status.label, "Desligado");
    assert.equal(status.opensSettings, true);
    assert.equal(status.tone, "warn");
    assert.match(status.hint, /atrasar/);
  });

  it("na web o alarme exato é só do app Android", () => {
    const status = exactAlarmStatus("unsupported", false);
    assert.equal(status.label, "Só no app Android");
    assert.equal(status.opensSettings, false);
    assert.equal(status.tone, "muted");
  });
});

describe("status da otimização de bateria", () => {
  it("na web a linha continua informativa e não abre configurações", () => {
    const status = batteryStatus(null, false);
    assert.equal(status.label, "Só no app Android");
    assert.equal(status.opensSettings, false);
    assert.match(status.hint, /aba aberta/);
  });

  it("sem restrição mostra que o Android não atrasa os avisos", () => {
    const status = batteryStatus(true, true);
    assert.equal(status.label, "Sem restrição");
    assert.equal(status.tone, "ok");
    assert.equal(status.opensSettings, true);
  });

  it("otimização ativa é um aviso, não um bloqueio", () => {
    const status = batteryStatus(false, true);
    assert.equal(status.label, "Otimização ativa");
    assert.equal(status.tone, "warn");
    assert.equal(status.opensSettings, true);
    assert.match(status.hint, /Toque aqui/);
  });

  it("estado desconhecido no Android ainda oferece a tela do sistema", () => {
    const status = batteryStatus(null, true);
    assert.equal(status.label, "Não informado");
    assert.equal(status.opensSettings, true);
  });
});

describe("botão de testar conexão", () => {
  it("passa por idle, loading e erro com os rótulos existentes", () => {
    assert.equal(testConnectionLabel("idle"), "Testar conexão");
    assert.equal(testConnectionLabel("loading"), "Testando…");
    assert.equal(testConnectionLabel("error"), "Tentar de novo");
    assert.equal(testConnectionLabel("success"), "Testar conexão");
  });

  it("só o sucesso traz a mensagem de conexão ok", () => {
    assert.equal(testConnectionMessage("success"), "Conexão ok.");
    for (const state of ["idle", "loading", "error"] as const) {
      assert.equal(testConnectionMessage(state), null);
    }
  });
});

describe("status do armazenamento persistente", () => {
  it("concedido aparece como Ativo", () => {
    const status = storageStatus({ supported: true, persisted: true });
    assert.equal(status.label, "Ativo");
    assert.equal(status.tone, "ok");
  });

  it("negado mantém o backup manual como saída", () => {
    const status = storageStatus({ supported: true, persisted: false });
    assert.equal(status.label, "Não concedido");
    assert.match(status.hint, /backup manual/);
  });

  it("ambiente sem a API não finge um estado", () => {
    const status = storageStatus({ supported: false, persisted: null });
    assert.equal(status.label, "Não informado");
    assert.equal(status.tone, "muted");
  });
});

describe("versão em Sobre", () => {
  it("prefixa com v e remove um v repetido", () => {
    assert.equal(appVersionLabel("1.0.0"), "v1.0.0");
    assert.equal(appVersionLabel("v1.0.0"), "v1.0.0");
    assert.equal(appVersionLabel(" 2.3.4 "), "v2.3.4");
  });

  it("build sem versão usa travessão", () => {
    assert.equal(appVersionLabel(""), "—");
    assert.equal(appVersionLabel("   "), "—");
  });
});
