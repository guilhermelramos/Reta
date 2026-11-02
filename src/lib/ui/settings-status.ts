/**
 * Rótulos e estados da tela Ajustes.
 *
 * Fica fora do React (e dos plugins) para os testes em Node cobrirem o texto
 * exato que a pessoa vê: status da chave, da permissão, do alarme exato, da
 * otimização de bateria e do armazenamento. A UI só escolhe a cor pelo `tone`.
 */

import { NOTIFICATIONS_DENIED_MESSAGE } from "../feedback/error-copy.ts";

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

/* ------------------------------------------------------------------ *
 * Notificações
 * ------------------------------------------------------------------ */

export type ReminderPermission = "granted" | "denied" | "default" | "unsupported";

export function remindersStatus(permission: ReminderPermission, native: boolean): StatusCopy {
  if (permission === "granted") {
    return {
      label: "Ativadas",
      hint: native
        ? "Os avisos são agendados no próprio aparelho, mesmo com o app fechado."
        : "Os avisos chegam com o Reta aberto ou instalado.",
      tone: "ok",
    };
  }
  if (permission === "denied") {
    return {
      label: "Bloqueadas",
      hint: NOTIFICATIONS_DENIED_MESSAGE,
      tone: "warn",
    };
  }
  if (permission === "unsupported") {
    return {
      label: "Indisponível",
      hint: "Este ambiente não mostra notificações.",
      tone: "muted",
    };
  }
  return {
    label: "Não ativadas",
    hint: "Toque em “Ativar lembretes” para receber os avisos.",
    tone: "muted",
  };
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
