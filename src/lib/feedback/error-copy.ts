/**
 * Tradução de erros para o texto e a ação dos componentes de feedback.
 *
 * É lógica pura (sem React, sem `fetch`) para os testes em Node cobrirem os
 * textos exatos decididos pelo Consultor. A UI só escolhe entre `InlineError`
 * (banner dentro do cartão) e `ErrorState` (cartão cheio) e executa a `action`.
 */

import type { AiErrorKind } from "../ai/errors.ts";

export type FeedbackKind =
  | "offline"
  | "rate-limit"
  | "unauthorized"
  | "missing-key"
  | "no-credits"
  | "vision"
  | "notifications"
  | "sheet"
  | "block"
  | "timeout"
  | "server"
  | "empty"
  | "unknown";

export type FeedbackActionId =
  | "retry"
  | "update-key"
  | "open-settings"
  | "choose-file"
  | "download-template"
  | "today-plan"
  | "use-free-model"
  | "open-credits"
  | "use-vision-model";

export type FeedbackAction = {
  id: FeedbackActionId;
  label: string;
  /** Rota interna, quando a ação navega (ex.: Ajustes, plano de hoje). */
  href?: "/" | "/ajustes";
  /** Segundos de espera antes de liberar o botão de tentar de novo. */
  retryAfterSeconds?: number;
  /** Abre em nova janela/navegador externo (sem plugin novo). */
  externalUrl?: string;
  /** Preset que a tela aplica em 1 toque (modelo grátis / com visão). */
  preset?: "fast-free" | "vision";
};

export type ErrorCopy = {
  kind: FeedbackKind;
  title: string;
  message: string;
  /** Linha/coluna ou motivo adicional, mostrado em letra menor. */
  detail?: string;
  action?: FeedbackAction;
  /** Link secundário do `ErrorState` (ex.: Baixar modelo). */
  secondaryAction?: FeedbackAction;
};

export type SheetProblem = {
  missingColumns?: string[];
  row?: number;
  column?: string;
  reason?: string;
};

export type DescribeErrorOptions = {
  /** `false` quando `navigator.onLine` já sabe que não há rede. */
  online?: boolean;
  /** Estado da permissão de notificação, quando a tela está pedindo. */
  notifications?: "granted" | "denied" | "default" | "unsupported";
  /** Problema de planilha detectado na importação. */
  sheet?: SheetProblem;
  /** Bloco que sumiu do plano (sessão aberta por link antigo). */
  blockMissing?: boolean;
};

export const OFFLINE_MESSAGE = "Você está offline. Pacotes baixados continuam funcionando.";
export const RATE_LIMIT_MESSAGE = "Muitas perguntas seguidas. Aguarde ~1 min.";
export const INVALID_KEY_MESSAGE = "Chave xAI inválida.";
export const OPENROUTER_INVALID_KEY_MESSAGE =
  "Chave do OpenRouter inválida ou revogada. Cole uma nova em Ajustes.";
export const OPENROUTER_NO_CREDITS_MESSAGE =
  "Sem créditos no OpenRouter. Escolha um modelo grátis ou recarregue.";
export const OPENROUTER_VISION_MESSAGE =
  "Este modelo não lê imagens. Use um modelo com visão para anexar a foto.";
export const OPENROUTER_CREDITS_URL = "https://openrouter.ai/settings/credits";
export const NOTIFICATIONS_DENIED_MESSAGE =
  "Lembretes desativados. Você não vai receber aviso do timer.";
export const SHEET_MESSAGE =
  "Não encontramos as colunas Data, Bloco A, Bloco B e Revisão.";
export const BLOCK_MISSING_MESSAGE =
  "Esse bloco não existe mais no seu plano (talvez a planilha tenha mudado).";

/** Sem `Retry-After`, o texto "~1 min" e a contagem começam em 60 s. */
export const RATE_LIMIT_DEFAULT_SECONDS = 60;

const DEFAULT_SHEET_COLUMNS = ["Data", "Bloco A", "Bloco B", "Revisão"];

export function retryAction(retryAfterSeconds?: number | null): FeedbackAction {
  const seconds =
    retryAfterSeconds != null && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.ceil(retryAfterSeconds)
      : undefined;
  return {
    id: "retry",
    label: "Tentar de novo",
    ...(seconds != null ? { retryAfterSeconds: seconds } : {}),
  };
}

export function offlineCopy(): ErrorCopy {
  return {
    kind: "offline",
    title: "Sem internet",
    message: OFFLINE_MESSAGE,
    action: retryAction(),
  };
}

export function rateLimitCopy(retryAfterSeconds?: number | null): ErrorCopy {
  return {
    kind: "rate-limit",
    title: "Muitas perguntas seguidas",
    message: RATE_LIMIT_MESSAGE,
    action: retryAction(retryAfterSeconds ?? RATE_LIMIT_DEFAULT_SECONDS),
  };
}

/** 429 do OpenRouter: a contagem vai no texto e a troca de modelo é a saída. */
export function openRouterRateLimitCopy(retryAfterSeconds?: number | null): ErrorCopy {
  const seconds =
    retryAfterSeconds != null && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.ceil(retryAfterSeconds)
      : RATE_LIMIT_DEFAULT_SECONDS;
  return {
    kind: "rate-limit",
    title: "Limite de uso atingido",
    message: `Limite de uso atingido. Tente em ${seconds} s ou troque de modelo.`,
    action: retryAction(seconds),
    secondaryAction: { id: "use-free-model", label: "Usar modelo grátis", preset: "fast-free" },
  };
}

export function unauthorizedCopy(): ErrorCopy {
  return {
    kind: "unauthorized",
    title: "Chave recusada",
    message: INVALID_KEY_MESSAGE,
    action: { id: "update-key", label: "Atualizar chave", href: "/ajustes" },
  };
}

export function openRouterUnauthorizedCopy(): ErrorCopy {
  return {
    kind: "unauthorized",
    title: "Chave recusada",
    message: OPENROUTER_INVALID_KEY_MESSAGE,
    action: { id: "update-key", label: "Atualizar chave", href: "/ajustes" },
  };
}

export function openRouterNoCreditsCopy(): ErrorCopy {
  return {
    kind: "no-credits",
    title: "Sem créditos",
    message: OPENROUTER_NO_CREDITS_MESSAGE,
    action: { id: "use-free-model", label: "Usar modelo grátis", preset: "fast-free" },
    secondaryAction: {
      id: "open-credits",
      label: "Recarregar",
      externalUrl: OPENROUTER_CREDITS_URL,
    },
  };
}

export function visionUnsupportedCopy(): ErrorCopy {
  return {
    kind: "vision",
    title: "Modelo sem visão",
    message: OPENROUTER_VISION_MESSAGE,
    action: { id: "use-vision-model", label: "Usar modelo que lê fotos", preset: "vision" },
  };
}

export function missingKeyCopy(message = "Sem chave da xAI. Cole a sua chave em Ajustes."): ErrorCopy {
  return {
    kind: "missing-key",
    title: "Falta a chave da xAI",
    message,
    action: { id: "update-key", label: "Atualizar chave", href: "/ajustes" },
  };
}

export function notificationsDeniedCopy(): ErrorCopy {
  return {
    kind: "notifications",
    title: "Notificações bloqueadas",
    message: NOTIFICATIONS_DENIED_MESSAGE,
    action: { id: "open-settings", label: "Abrir configurações" },
  };
}

function withPeriod(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function sheetDetail(problem: SheetProblem): string | undefined {
  const parts: string[] = [];
  const reason = problem.reason?.trim();
  const at = problem.column
    ? `coluna ${problem.column}`
    : undefined;
  if (problem.row != null) {
    const where = at ? `Linha ${problem.row}, ${at}` : `Linha ${problem.row}`;
    parts.push(withPeriod(reason ? `${where}: ${reason}` : where));
  } else if (at) {
    parts.push(withPeriod(reason ? `${at}: ${reason}` : at));
  }
  if (problem.missingColumns?.length) {
    parts.push(`Faltam: ${problem.missingColumns.join(", ")}.`);
  } else if (!parts.length && problem.reason?.trim()) {
    parts.push(problem.reason.trim());
  }
  return parts.length ? parts.join(" ") : undefined;
}

export function sheetErrorCopy(problem: SheetProblem = {}): ErrorCopy {
  const hasProblem =
    Boolean(problem.missingColumns?.length) ||
    problem.row != null ||
    problem.column != null ||
    Boolean(problem.reason?.trim());
  const missing = problem.missingColumns?.length
    ? problem.missingColumns
    : hasProblem
      ? []
      : DEFAULT_SHEET_COLUMNS;
  const detail = hasProblem ? sheetDetail({ ...problem, missingColumns: missing }) : undefined;
  return {
    kind: "sheet",
    title: "Planilha não reconhecida",
    message: SHEET_MESSAGE,
    ...(detail ? { detail } : {}),
    action: { id: "choose-file", label: "Escolher outro arquivo" },
    secondaryAction: { id: "download-template", label: "Baixar modelo" },
  };
}

/**
 * Converte um aviso do parser (`{ row, message }`) na linha/coluna que a
 * pessoa precisa conferir na planilha.
 */
export function sheetProblemFromWarning(warning: {
  row: number;
  message: string;
}): SheetProblem {
  const message = warning.message;
  let column: string | undefined;
  if (/data inválida/i.test(message)) column = "Data";
  else if (/tempo do bloco a/i.test(message)) column = "Min A";
  else if (/tempo do bloco b/i.test(message)) column = "Min B";
  else if (/tempo da revisão/i.test(message)) column = "Min Revisão";
  else if (/sem conteúdo/i.test(message)) column = "Bloco A";
  return {
    row: warning.row,
    ...(column ? { column } : {}),
    reason: message.replace(/\s*—.*$/, "").replace(/\.$/, ""),
  };
}

export function blockMissingCopy(): ErrorCopy {
  return {
    kind: "block",
    title: "Bloco não encontrado",
    message: BLOCK_MISSING_MESSAGE,
    action: { id: "today-plan", label: "Ver plano de hoje", href: "/" },
  };
}

export function timeoutCopy(): ErrorCopy {
  return {
    kind: "timeout",
    title: "A IA não respondeu",
    message: "A resposta não chegou em 15 s. Tente de novo.",
    action: retryAction(),
  };
}

export function serverCopy(message = "A IA está indisponível agora. Tente de novo em instantes."): ErrorCopy {
  return {
    kind: "server",
    title: "IA indisponível",
    message,
    action: retryAction(),
  };
}

export function genericCopy(message = "Não deu para concluir. Tente de novo."): ErrorCopy {
  return {
    kind: "unknown",
    title: "Não deu para concluir",
    message,
    action: retryAction(),
  };
}

type FailureLike = {
  kind?: string;
  message?: string;
  status?: number;
  retryAfterSeconds?: number | null;
  provider?: string;
};

function readFailure(error: unknown): FailureLike | null {
  if (!error) return null;
  if (error instanceof Error) {
    const candidate = error as Error & Partial<FailureLike>;
    return {
      kind: typeof candidate.kind === "string" ? candidate.kind : undefined,
      message: error.message,
      status: typeof candidate.status === "number" ? candidate.status : undefined,
      retryAfterSeconds:
        typeof candidate.retryAfterSeconds === "number" || candidate.retryAfterSeconds === null
          ? candidate.retryAfterSeconds
          : undefined,
      ...(typeof candidate.provider === "string" ? { provider: candidate.provider } : {}),
    };
  }
  if (typeof error === "string") return { message: error };
  if (typeof error === "object") {
    const candidate = error as FailureLike;
    if (typeof candidate.message === "string" || typeof candidate.kind === "string") {
      return candidate;
    }
  }
  return null;
}

function failureKind(failure: FailureLike | null): AiErrorKind | undefined {
  const kind = failure?.kind;
  if (
    kind === "offline" ||
    kind === "timeout" ||
    kind === "unauthorized" ||
    kind === "rate-limit" ||
    kind === "server" ||
    kind === "bad-request" ||
    kind === "empty" ||
    kind === "missing-key" ||
    kind === "no-credits" ||
    kind === "vision" ||
    kind === "unknown"
  ) {
    return kind;
  }
  return undefined;
}

function isOpenRouterFailure(failure: FailureLike | null): boolean {
  if (failure?.provider === "openrouter") return true;
  return /openrouter/i.test(failure?.message ?? "");
}

function copyForKind(
  kind: AiErrorKind | undefined,
  failure: FailureLike | null,
): ErrorCopy | null {
  const openRouter = isOpenRouterFailure(failure);
  if (kind === "offline") return offlineCopy();
  if (kind === "rate-limit" || failure?.status === 429) {
    return openRouter
      ? openRouterRateLimitCopy(failure?.retryAfterSeconds)
      : rateLimitCopy(failure?.retryAfterSeconds);
  }
  if (kind === "unauthorized" || failure?.status === 401 || failure?.status === 403) {
    return openRouter ? openRouterUnauthorizedCopy() : unauthorizedCopy();
  }
  if (kind === "no-credits" || failure?.status === 402) return openRouterNoCreditsCopy();
  if (kind === "vision") return visionUnsupportedCopy();
  if (kind === "missing-key") {
    return openRouter
      ? {
          kind: "missing-key",
          title: "Falta a chave do OpenRouter",
          message:
            failure?.message ||
            "Sem chave do OpenRouter. Cole a sua chave (sk-or-…) em Ajustes.",
          action: { id: "update-key", label: "Atualizar chave", href: "/ajustes" },
        }
      : missingKeyCopy(failure?.message);
  }
  if (kind === "timeout") return timeoutCopy();
  if (kind === "server") return serverCopy(failure?.message);
  return null;
}

/**
 * Versão única usada pela UI: problema de planilha/bloco tem prioridade,
 * depois o estado de notificação, depois o erro de IA (com `kind`/status) e,
 * por fim, o texto já traduzido pelo cliente.
 */
export function describeError(
  error: unknown,
  options: DescribeErrorOptions = {},
): ErrorCopy {
  if (options.blockMissing) return blockMissingCopy();
  if (options.sheet) return sheetErrorCopy(options.sheet);
  if (options.notifications === "denied" || options.notifications === "unsupported") {
    return notificationsDeniedCopy();
  }
  if (options.online === false) return offlineCopy();

  const failure = readFailure(error);
  const kind = failureKind(failure);
  const mapped = copyForKind(kind, failure);
  if (mapped) return mapped;

  const message = failure?.message?.trim() ?? "";
  if (/sem (internet|conex)/i.test(message)) return offlineCopy();
  const openRouter = isOpenRouterFailure(failure);
  if (/limite de uso|muitas perguntas|429/i.test(message)) {
    return openRouter
      ? openRouterRateLimitCopy(failure?.retryAfterSeconds)
      : rateLimitCopy(failure?.retryAfterSeconds);
  }
  if (/sem créditos|402|recarregue/i.test(message)) return openRouterNoCreditsCopy();
  if (/não lê imagens|sem visão|modelo.*imagem/i.test(message)) {
    return visionUnsupportedCopy();
  }
  if (/chave.*(recusada|inválida)/i.test(message)) {
    return openRouter ? openRouterUnauthorizedCopy() : unauthorizedCopy();
  }
  if (/sem chave/i.test(message)) return missingKeyCopy(message);
  if (/demorou demais|não respondeu|timeout|15 s/i.test(message)) return timeoutCopy();
  if (message.length > 0) return genericCopy(message);
  return genericCopy();
}
