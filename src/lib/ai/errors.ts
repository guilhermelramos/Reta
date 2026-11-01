/**
 * Tradução dos erros de rede/API da IA para mensagens claras em português.
 *
 * É lógica pura (sem `fetch`, sem Capacitor) para os dois caminhos usarem a
 * mesma mensagem: servidor na web e CapacitorHttp no APK. Os testes em
 * `errors.test.ts` cobrem o mapeamento, inclusive o `Retry-After` do 429.
 */

export type AiErrorKind =
  | "offline"
  | "timeout"
  | "unauthorized"
  | "missing-key"
  | "rate-limit"
  | "server"
  | "bad-request"
  | "empty"
  | "unknown";

/**
 * Erro estruturado que atravessa `AiResult` sem perder o `kind`/status — é o
 * que permite a UI escolher o texto e a ação certos (chave, 429, offline).
 */
export type AiFailure = {
  kind: AiErrorKind;
  message: string;
  status?: number;
  retryAfterSeconds?: number | null;
};

export const OFFLINE_MESSAGE = "Sem internet. Conecte-se e tente de novo.";
export const NETWORK_MESSAGE =
  "Sem internet ou a IA não respondeu. Verifique a conexão e tente de novo.";
export const TIMEOUT_MESSAGE =
  "A IA demorou demais para responder. Verifique a internet e tente de novo.";
export const EMPTY_MESSAGE = "A IA voltou vazia. Tente de novo.";

export type AiErrorInfo = {
  status?: number;
  retryAfterSeconds?: number | null;
};

/** Erro já traduzido: `mapFailure` devolve a mensagem sem remapear. */
export class AiRequestError extends Error {
  readonly kind: AiErrorKind;
  readonly status?: number;
  readonly retryAfterSeconds?: number | null;

  constructor(message: string, kind: AiErrorKind = "unknown", info: AiErrorInfo = {}) {
    super(message);
    this.name = "AiRequestError";
    this.kind = kind;
    this.status = info.status;
    this.retryAfterSeconds = info.retryAfterSeconds;
  }
}

export function timeoutError(message = TIMEOUT_MESSAGE): AiRequestError {
  return new AiRequestError(message, "timeout");
}

export function emptyError(message = EMPTY_MESSAGE): AiRequestError {
  return new AiRequestError(message, "empty");
}

/**
 * `Retry-After` aceita segundos (`"12"`) ou data HTTP
 * (`"Wed, 21 Oct 2026 07:28:00 GMT"`). Devolve segundos restantes.
 */
export function retryAfterSeconds(
  value: string | number | null | undefined,
  now: number = Date.now(),
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.ceil(value) : null;
  }
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Math.max(0, Number(raw));
  const date = Date.parse(raw);
  if (!Number.isFinite(date)) return null;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

/** Recorta o corpo do erro e esconde tokens/chaves antes de mostrar à pessoa. */
export function sanitizedErrorBody(body: string, max = 160): string {
  return body
    .replace(/<[^>]+>/g, " ")
    .replace(/[A-Za-z0-9_-]{20,}/g, "•••")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Mapeia status HTTP + corpo + Retry-After para a mensagem final. */
export function httpError(
  status: number,
  body = "",
  options: {
    retryAfter?: string | number | null;
    providerLabel?: string;
    now?: number;
  } = {},
): AiRequestError {
  const label = options.providerLabel?.trim() || "xAI";
  const detail = sanitizedErrorBody(body);

  if (status === 401 || status === 403) {
    return new AiRequestError(
      `A chave da ${label} foi recusada. Confira a chave em Ajustes.`,
      "unauthorized",
      {
        status,
      },
    );
  }

  if (status === 429) {
    const seconds = retryAfterSeconds(options.retryAfter, options.now);
    const wait =
      seconds != null && seconds > 0
        ? `Espere ${seconds} s e tente de novo.`
        : "Espere um pouco e tente de novo.";
    return new AiRequestError(`Limite de uso da API atingido. ${wait}`, "rate-limit", {
      status,
      retryAfterSeconds: seconds,
    });
  }

  if (status === 408 || status === 504) {
    return new AiRequestError(TIMEOUT_MESSAGE, "timeout", { status });
  }

  if (status >= 500) {
    return new AiRequestError(
      `A IA está indisponível agora (erro ${status}). Tente de novo em instantes.`,
      "server",
      {
        status,
      },
    );
  }

  if (status >= 400) {
    const suffix = detail ? `: ${detail}` : ".";
    return new AiRequestError(`A IA recusou o pedido (erro ${status})${suffix}`, "bad-request", {
      status,
    });
  }

  return new AiRequestError(
    detail ? `Falha ${status} ao falar com a IA: ${detail}` : `Falha ${status} ao falar com a IA.`,
    "unknown",
    {
      status,
    },
  );
}

const TIMEOUT_RE = /timeout|timed out|time out|aborted|abort|demorou demais|não respondeu a tempo/i;
const NETWORK_RE =
  /failed to fetch|networkerror|network error|network request failed|load failed|fetch failed|econnrefused|enotfound|econnreset|unreachable|offline|sem internet/i;

/**
 * Falha de transporte (fetch/CapacitorHttp). `navigator.onLine === false` é o
 * sinal mais confiável no WebView; a mensagem do erro cobre o resto.
 */
export function transportFailure(
  error: unknown,
  options: { online?: boolean } = {},
): AiRequestError {
  if (error instanceof AiRequestError) return error;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (TIMEOUT_RE.test(message)) return timeoutError();
  if (options.online === false || !message.trim() || NETWORK_RE.test(message)) {
    return new AiRequestError(
      options.online === false ? OFFLINE_MESSAGE : NETWORK_MESSAGE,
      "offline",
    );
  }
  return new AiRequestError(message, "unknown");
}

/**
 * Versão estruturada de `mapFailure`: mantém `kind`, status e `Retry-After`
 * para a UI mapear a ação (ex.: 401 → Atualizar chave, 429 → contagem).
 */
export function failureOf(
  error: unknown,
  options: { online?: boolean } = {},
): AiFailure {
  let info: AiRequestError;
  if (error instanceof AiRequestError) {
    info = error;
  } else {
    const transport = transportFailure(error, options);
    info =
      transport.kind === "unknown"
        ? new AiRequestError(mapFailure(error, options), "unknown")
        : transport;
  }
  return {
    kind: info.kind,
    message: info.message,
    ...(info.status != null ? { status: info.status } : {}),
    retryAfterSeconds: info.retryAfterSeconds ?? null,
  };
}

/** Mensagem final para qualquer falha do fluxo de IA. */
export function mapFailure(error: unknown, options: { online?: boolean } = {}): string {
  if (error instanceof AiRequestError) return error.message;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (options.online === false) return OFFLINE_MESSAGE;
  if (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")) ||
    TIMEOUT_RE.test(message)
  ) {
    return TIMEOUT_MESSAGE;
  }
  if (NETWORK_RE.test(message)) return NETWORK_MESSAGE;
  if (message.trim()) return message;
  return "Falha ao falar com a IA. Tente de novo.";
}
