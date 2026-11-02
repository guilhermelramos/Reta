import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alertLock,
  alertLockHint,
  appVersionLabel,
  batteryStatus,
  canSaveKey,
  canTestConnection,
  exactAlarmStatus,
  formatStudyTimeTyping,
  keySaveLabel,
  keySaveNeedsConfirm,
  keyStatus,
  notificationsCard,
  NOTIFICATIONS_CARD_HINT,
  parseStudyTime,
  storageStatus,
  studyTimeValue,
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

  it("salvar só habilita com texto no campo (trim)", () => {
    assert.equal(canSaveKey("xai-abc"), true);
    assert.equal(canSaveKey("  xai-abc  "), true);
    for (const value of ["", "   ", "\n\t"]) assert.equal(canSaveKey(value), false);
  });

  it("sobrescrever uma chave salva pede confirmação; salvar a mesma não", () => {
    assert.equal(keySaveNeedsConfirm("xai-antiga", "xai-nova"), true);
    assert.equal(keySaveNeedsConfirm("xai-antiga", " xai-antiga "), false);
    assert.equal(keySaveNeedsConfirm("", "xai-nova"), false);
    assert.equal(keySaveNeedsConfirm("xai-antiga", ""), false);
  });
});

describe("cartão único de permissão de notificações", () => {
  it("concedida mostra Ativadas e nenhum botão", () => {
    const card = notificationsCard("granted", true);
    assert.equal(card.label, "Ativadas");
    assert.equal(card.tone, "ok");
    assert.equal(card.action, null);
    assert.equal(card.actionLabel, null);
    assert.match(card.hint, /próprio aparelho/);
  });

  it("não pedida usa o texto único e oferece Ativar notificações", () => {
    const card = notificationsCard("default", true);
    assert.equal(card.label, "Não pedida");
    assert.equal(card.tone, "muted");
    assert.equal(card.hint, NOTIFICATIONS_CARD_HINT);
    assert.equal(card.action, "request");
    assert.equal(card.actionLabel, "Ativar notificações");
  });

  it("bloqueada usa o mesmo texto e abre as configurações", () => {
    const card = notificationsCard("denied", true);
    assert.equal(card.label, "Bloqueadas");
    assert.equal(card.tone, "warn");
    assert.equal(card.hint, NOTIFICATIONS_CARD_HINT);
    assert.equal(card.action, "settings");
    assert.equal(card.actionLabel, "Abrir configurações");
  });

  it("ambiente sem suporte não inventa uma ação", () => {
    const card = notificationsCard("unsupported", false);
    assert.equal(card.label, "Indisponível");
    assert.equal(card.action, null);
  });
});

describe("travas dos controles dependentes", () => {
  it("permissão concedida e modo silencioso desligado libera", () => {
    assert.equal(alertLock("granted", false), null);
    assert.equal(alertLockHint(null), null);
  });

  it("qualquer permissão diferente de concedida trava pelo motivo da permissão", () => {
    for (const permission of ["denied", "default", "unsupported"] as const) {
      assert.equal(alertLock(permission, false), "permission");
    }
    assert.match(alertLockHint("permission") ?? "", /Ative as notificações/);
  });

  it("modo silencioso trava mesmo com a permissão concedida", () => {
    assert.equal(alertLock("granted", true), "quiet");
    assert.match(alertLockHint("quiet") ?? "", /modo silencioso/);
  });
});

describe("horário de estudo", () => {
  it("o minuto sempre aparece com dois dígitos", () => {
    assert.equal(studyTimeValue(14, 0), "14:00");
    assert.equal(studyTimeValue(9, 5), "09:05");
    assert.equal(studyTimeValue(23, 59), "23:59");
  });

  it("valores fora da faixa são normalizados, sem mudar o modelo", () => {
    assert.equal(studyTimeValue(28, 70), "23:59");
    assert.equal(studyTimeValue(-1, -1), "00:00");
    assert.equal(studyTimeValue(Number.NaN, Number.NaN), "00:00");
  });

  it("lê o HH:MM do seletor e rejeita vazio/inválido", () => {
    assert.deepEqual(parseStudyTime("14:00"), { hour: 14, minute: 0 });
    assert.deepEqual(parseStudyTime(" 8:05 "), { hour: 8, minute: 5 });
    assert.equal(parseStudyTime(""), null);
    assert.equal(parseStudyTime("24:00"), null);
    assert.equal(parseStudyTime("12:60"), null);
    assert.equal(parseStudyTime("12"), null);
  });

  it("a digitação ganha os dois pontos e o minuto de dois dígitos", () => {
    assert.equal(formatStudyTimeTyping("1400"), "14:00");
    assert.equal(formatStudyTimeTyping("9"), "9");
    assert.equal(formatStudyTimeTyping("14:0"), "14:0");
    assert.equal(formatStudyTimeTyping("14:00:00"), "14:00");
    assert.equal(formatStudyTimeTyping("abc14h00"), "14:00");
    assert.equal(formatStudyTimeTyping(""), "");
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
    assert.equal(status.hint, "Alarme exato desativado: o aviso pode atrasar alguns minutos.");
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
  it("só habilita com chave salva ou texto (trim) no campo", () => {
    assert.equal(canTestConnection(true, ""), true);
    assert.equal(canTestConnection(true, "   "), true);
    assert.equal(canTestConnection(false, "xai-abc"), true);
    assert.equal(canTestConnection(false, "  xai-abc  "), true);
    for (const value of ["", "   ", "\n\t"]) {
      assert.equal(canTestConnection(false, value), false);
    }
  });

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
