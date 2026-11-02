/**
 * Rótulos e estados da tela Ajustes.
 *
 * Fica fora do React (e dos plugins) para os testes em Node cobrirem o texto
 * exato que a pessoa vê: status da chave, da permissão, do alarme exato, da
 * otimização de bateria e do armazenamento. A UI só escolhe a cor pelo `tone`.
 */

export type StatusTone = "ok" | "warn" | "muted";

export type StatusCopy = {
  label: string;
  hint: string;
  tone: StatusTone;
};

/* ------------------------------------------------------------------ *
 * Chave xAI
 * ------------------------------------------------------------------ */

export type KeyStatus = StatusCopy & { configured: boolean };

/** "Conectada" significa que existe uma chave salva no cofre do aparelho. */
export function keyStatus(value: string): KeyStatus {
  const configured = value.trim().length > 0;
  if (configured) {
    return {
      configured,
      label: "Conectada",
      hint: "A chave fica só neste aparelho, no cofre seguro do sistema.",
      tone: "ok",
    };
  }
  return {
    configured,
    label: "Não configurada",
    hint: "Sem chave, os recursos de IA pedem para configurar aqui.",
    tone: "muted",
  };
}

/** O botão principal do formulário muda de verbo quando já há chave salva. */
export function keySaveLabel(configured: boolean): string {
  return configured ? "Atualizar chave" : "Salvar chave";
}

/** O "Salvar chave" só habilita com algum texto (trim) no campo. */
export function canSaveKey(draft: string): boolean {
  return draft.trim().length > 0;
}

/**
 * Só pede confirmação quando existe uma chave salva e o campo traz outra
 * chave. Salvar o mesmo valor (ou salvar a primeira chave) não sobrescreve
 * nada e não precisa de diálogo.
 */
export function keySaveNeedsConfirm(saved: string, draft: string): boolean {
  const current = saved.trim();
  const next = draft.trim();
  return current.length > 0 && next.length > 0 && current !== next;
}

/* ------------------------------------------------------------------ *
 * Notificações
 * ------------------------------------------------------------------ */

export type ReminderPermission = "granted" | "denied" | "default" | "unsupported";

/** Texto único do cartão de permissão (o mesmo nas três antigas repetições). */
export const NOTIFICATIONS_CARD_HINT =
  "Ative para receber os avisos do timer e do horário de estudo.";

export type NotificationsAction = "request" | "settings";

export type NotificationsCard = {
  /** Badge do estado real da permissão. */
  label: string;
  hint: string;
  tone: StatusTone;
  action: NotificationsAction | null;
  actionLabel: string | null;
};

/**
 * Um único cartão de status da permissão de notificações: badge, uma frase e no
 * máximo um botão tonal. `request` pede a permissão; `settings` aparece quando o
 * Android já negou e só resta abrir as configurações do app. Concedida, o botão
 * some.
 */
export function notificationsCard(
  permission: ReminderPermission,
  native: boolean,
): NotificationsCard {
  if (permission === "granted") {
    return {
      label: "Ativadas",
      hint: native
        ? "Os avisos são agendados no próprio aparelho, mesmo com o app fechado."
        : "Os avisos chegam com o Reta aberto ou instalado.",
      tone: "ok",
      action: null,
      actionLabel: null,
    };
  }
  if (permission === "denied") {
    return {
      label: "Bloqueadas",
      hint: NOTIFICATIONS_CARD_HINT,
      tone: "warn",
      action: "settings",
      actionLabel: "Abrir configurações",
    };
  }
  if (permission === "unsupported") {
    return {
      label: "Indisponível",
      hint: "Este ambiente não mostra notificações.",
      tone: "muted",
      action: null,
      actionLabel: null,
    };
  }
  return {
    label: "Não pedida",
    hint: NOTIFICATIONS_CARD_HINT,
    tone: "muted",
    action: "request",
    actionLabel: "Ativar notificações",
  };
}

/** Por que os controles dependentes estão travados; `null` = liberados. */
export type AlertLock = "quiet" | "permission";

/**
 * Lembretes dependentes e horário de estudo só funcionam com a permissão
 * concedida e fora do modo silencioso. O valor salvo nunca é apagado: só o
 * controle fica desabilitado.
 */
export function alertLock(permission: ReminderPermission, quiet: boolean): AlertLock | null {
  if (quiet) return "quiet";
  if (permission !== "granted") return "permission";
  return null;
}

/** Apoio curto mostrado abaixo dos controles travados. */
export function alertLockHint(lock: AlertLock | null): string | null {
  if (lock === "quiet") return "Desligado enquanto o modo silencioso estiver ativo.";
  if (lock === "permission") return "Ative as notificações para usar este ajuste.";
  return null;
}

/**
 * Valor do seletor de horário: o minuto sempre com dois dígitos (`14:00`). O
 * modelo de dados continua sendo `studyHour`/`studyMinute`.
 */
export function studyTimeValue(hour: number, minute: number): string {
  const h = Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.round(hour))) : 0;
  const m = Number.isFinite(minute) ? Math.min(59, Math.max(0, Math.round(minute))) : 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Lê o `HH:MM` do seletor; `null` quando o valor está vazio/inválido. */
export function parseStudyTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Formata o que a pessoa digita no campo de horário sem depender do locale do
 * aparelho (que mostraria "02:00 PM" num `input type=time` em inglês):
 * "1400" vira "14:00" e o minuto sempre tem dois dígitos.
 */
export function formatStudyTimeTyping(raw: string): string {
  const value = raw.replace(/[^\d:]/g, "");
  const colon = value.indexOf(":");
  if (colon >= 0) {
    const hour = value.slice(0, colon).replace(/\D/g, "").slice(0, 2);
    const minute = value
      .slice(colon + 1)
      .replace(/\D/g, "")
      .slice(0, 2);
    return `${hour}:${minute}`;
  }
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export type ExactAlarmState = "granted" | "denied" | "unsupported";

export type SettingsStatus = StatusCopy & { opensSettings: boolean };

/**
 * `opensSettings` é `true` quando o Android negou os alarmes exatos: a linha
 * vira um botão "Abrir configurações" que leva à tela de alarmes do sistema.
 */
export function exactAlarmStatus(state: ExactAlarmState, native: boolean): SettingsStatus {
  if (state === "granted") {
    return {
      label: "Autorizado",
      hint: "O aviso toca no minuto certo, mesmo com a tela bloqueada.",
      tone: "ok",
      opensSettings: false,
    };
  }
  if (state === "denied") {
    return {
      label: "Desligado",
      hint: "Os avisos podem atrasar alguns minutos. Abra as configurações para permitir alarmes exatos.",
      tone: "warn",
      opensSettings: true,
    };
  }
  return {
    label: native ? "Indisponível" : "Só no app Android",
    hint: native
      ? "Este aparelho não informa o estado do alarme exato."
      : "No navegador o aviso depende da aba aberta.",
    tone: "muted",
    opensSettings: false,
  };
}

/**
 * Orientação de bateria, nunca bloqueante: a linha "Avisos atrasando? Toque
 * aqui" abre a tela de otimização do Android; na web mostra o caminho do
 * navegador.
 */
export function batteryStatus(ignored: boolean | null, native: boolean): SettingsStatus {
  if (!native) {
    return {
      label: "Só no app Android",
      hint: "No navegador, os avisos dependem da aba aberta. Abra o Reta no Android para ajustar a bateria.",
      tone: "muted",
      opensSettings: false,
    };
  }
  if (ignored === true) {
    return {
      label: "Sem restrição",
      hint: "O Android não está atrasando os avisos do Reta.",
      tone: "ok",
      opensSettings: true,
    };
  }
  if (ignored === false) {
    return {
      label: "Otimização ativa",
      hint: "O Android pode atrasar os avisos. Toque aqui para abrir a otimização de bateria.",
      tone: "warn",
      opensSettings: true,
    };
  }
  return {
    label: "Não informado",
    hint: "Toque aqui para ver a otimização de bateria do Android.",
    tone: "muted",
    opensSettings: true,
  };
}

/* ------------------------------------------------------------------ *
 * Teste de conexão
 * ------------------------------------------------------------------ */

export type TestState = "idle" | "loading" | "success" | "error";

export function testConnectionLabel(state: TestState): string {
  if (state === "loading") return "Testando…";
  if (state === "error") return "Tentar de novo";
  return "Testar conexão";
}

export function testConnectionMessage(state: TestState): string | null {
  return state === "success" ? "Conexão ok." : null;
}

/* ------------------------------------------------------------------ *
 * Armazenamento e versão
 * ------------------------------------------------------------------ */

export function storageStatus(input: {
  supported: boolean;
  persisted: boolean | null;
}): StatusCopy {
  if (!input.supported) {
    return {
      label: "Não informado",
      hint: "Este ambiente não expõe o estado do armazenamento. O backup manual continua valendo.",
      tone: "muted",
    };
  }
  if (input.persisted === true) {
    return {
      label: "Ativo",
      hint: "O sistema não descarta os dados do Reta por inatividade.",
      tone: "ok",
    };
  }
  return {
    label: "Não concedido",
    hint: "O backup manual continua valendo.",
    tone: "muted",
  };
}

/** "v1.0.0" para a linha Sobre; "—" quando o build não informou a versão. */
export function appVersionLabel(raw: string): string {
  const version = raw.trim().replace(/^v/i, "");
  return version ? `v${version}` : "—";
}
