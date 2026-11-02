/**
 * Fluxo device code da xAI (RFC 8628) — lógica pura, transporte injetável.
 *
 * Nada aqui importa `@capacitor/core`, `fetch` ou React: os testes usam um
 * transporte falso e um `sleep` instantâneo para cobrir `authorization_pending`,
 * `slow_down`, sucesso, expiração e refresh.
 *
 * Endpoints (descoberta em auth.x.ai/.well-known/openid-configuration):
 * - POST https://auth.x.ai/oauth2/device/code (form urlencoded)
 * - POST https://auth.x.ai/oauth2/token (form urlencoded)
 *
 * O `client_id` e os escopos vêm de `config.ts` e são NÃO OFICIAIS.
 */

import {
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_DEVICE_CODE_URL,
  XAI_OAUTH_SCOPE,
  XAI_OAUTH_TOKEN_URL,
} from "./config.ts";

export type AuthMethod = "GET" | "POST";

export type AuthHttpRequest = {
  method: AuthMethod;
  url: string;
  headers: Record<string, string>;
  /** Já serializado (`application/x-www-form-urlencoded`). */
  body?: string;
  timeoutMs?: number;
};

export type AuthHttpResponse = {
  status: number;
  data: unknown;
  headers: Record<string, string>;
};

export type AuthTransport = (request: AuthHttpRequest) => Promise<AuthHttpResponse>;

export type DeviceCode = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresInSeconds: number;
  intervalSeconds: number;
};

export type XaiTokens = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms; `0` quando a xAI não informou `expires_in`. */
  expiresAt: number;
  tokenType: string;
  scope: string;
};

export type XaiAuthErrorCode =
  | "authorization_pending"
  | "slow_down"
  | "expired_token"
  | "access_denied"
  | "invalid_grant"
  | "invalid_request"
  | "unauthorized"
  | "rate_limit"
  | "server"
  | "network"
  | "invalid_response"
  | "cancelled"
  | "unknown";

/** Evento do log diagnóstico em memória (sem tokens nem `device_code`). */
export type AuthDiagnosticKind =
  "device-code" | "poll" | "wake" | "transient" | "success" | "error";

export type AuthDiagnosticEvent = {
  /** Epoch ms. */
  at: number;
  kind: AuthDiagnosticKind;
  message: string;
  status?: number;
  oauthCode?: string;
};

/**
 * Últimos ~30 eventos do login, só em memória. Os textos nunca incluem corpo
 * de requisição, tokens ou `device_code`; a UI mostra isso em "Detalhes".
 */
export class AuthDiagnostics {
  private events: AuthDiagnosticEvent[] = [];
  private readonly limit: number;
  private readonly now: () => number;

  constructor(limit = 30, now: () => number = Date.now) {
    this.limit = limit;
    this.now = now;
  }

  add(
    kind: AuthDiagnosticKind,
    message: string,
    extra: { status?: number; oauthCode?: string } = {},
  ): void {
    this.events.push({ at: this.now(), kind, message, ...extra });
    if (this.events.length > this.limit) {
      this.events.splice(0, this.events.length - this.limit);
    }
  }

  list(): AuthDiagnosticEvent[] {
    return this.events.slice();
  }

  clear(): void {
    this.events = [];
  }
}

export type XaiAuthErrorOptions = {
  /** Status HTTP; ausente quando o transporte falhou antes de responder. */
  status?: number;
  /** Código OAuth do corpo (`error`), ex.: `authorization_pending`. */
  oauthCode?: string;
  /** `error_description` devolvido pela xAI. */
  description?: string;
  /** Mensagem crua do transporte (`Network request failed`, timeout…). */
  transportMessage?: string;
  endpoint?: string;
  /** Quantos polls foram feitos antes de desistir. */
  attempts?: number;
  /** Epoch ms do encerramento. */
  at?: number;
  /** Cópia do log diagnóstico no momento do erro. */
  events?: AuthDiagnosticEvent[];
};

/** Erro do login experimental, com o código e os detalhes reais da falha. */
export class XaiAuthError extends Error {
  readonly code: XaiAuthErrorCode;
  readonly status?: number;
  readonly oauthCode?: string;
  readonly description?: string;
  readonly transportMessage?: string;
  readonly endpoint?: string;
  readonly attempts?: number;
  readonly at?: number;
  readonly events?: AuthDiagnosticEvent[];

  constructor(
    message: string,
    code: XaiAuthErrorCode = "unknown",
    details: number | XaiAuthErrorOptions = {},
  ) {
    super(message);
    this.name = "XaiAuthError";
    const options = typeof details === "number" ? { status: details } : details;
    this.code = code;
    this.status = options.status;
    this.oauthCode = options.oauthCode;
    this.description = options.description;
    this.transportMessage = options.transportMessage;
    this.endpoint = options.endpoint;
    this.attempts = options.attempts;
    this.at = options.at;
    this.events = options.events;
  }
}

const FORM_HEADERS: Record<string, string> = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept: "application/json",
};

/** Mensagem em português para cada código conhecido. */
export function xaiAuthMessage(code: XaiAuthErrorCode): string {
  switch (code) {
    case "expired_token":
      return "O código expirou antes da autorização. Gere um novo.";
    case "access_denied":
      return "Você recusou o login na conta xAI. Tente de novo quando quiser.";
    case "invalid_grant":
      return "O login da conta xAI expirou ou foi revogado. Entre de novo.";
    case "unauthorized":
      return "A xAI recusou o login. Tente de novo mais tarde.";
    case "rate_limit":
      return "Muitas tentativas de login. Espere um pouco e tente de novo.";
    case "server":
      return "A xAI está indisponível agora. Tente de novo em instantes.";
    case "network":
      return "Sem internet ou a xAI não respondeu. Verifique a conexão.";
    case "invalid_request":
    case "invalid_response":
      return "O login experimental devolveu uma resposta inesperada. Use a chave de API.";
    case "cancelled":
      return "Login cancelado.";
    case "authorization_pending":
      return "Aguardando você autorizar o acesso no navegador.";
    case "slow_down":
      return "A xAI pediu para diminuir a frequência. Aguardando mais um pouco.";
    default:
      return "Não consegui concluir o login experimental. Use a chave de API.";
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** `error_description` do corpo, com fallback para `error.message`. */
export function authErrorDescription(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const row = data as Record<string, unknown>;
  const direct = text(row.error_description);
  if (direct) return direct;
  const nested = row.error;
  if (nested && typeof nested === "object") {
    return text((nested as { message?: unknown }).message);
  }
  return text(row.message);
}

/** Mensagem crua de uma exceção do transporte, para os "Detalhes". */
export function transportErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error.trim();
  return "falha desconhecida";
}

/** Esconde tokens/device codes caso algum texto de terceiro os repita. */
function redactSecrets(value: string): string {
  return value
    .replace(/(access_token|refresh_token|device_code)=([^&\s]+)/gi, "$1=[omitido]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[omitido]");
}

function formatEventTime(at: number): string {
  try {
    return new Date(at).toLocaleTimeString("pt-BR", { hour12: false });
  } catch {
    return new Date(at).toISOString();
  }
}

/**
 * Linhas copiáveis dos "Detalhes" (endpoint, status, código, descrição,
 * tentativas, horário e log). Nunca inclui token nem `device_code`.
 */
export function xaiAuthErrorLines(error: XaiAuthError): string[] {
  const lines = [
    `Endpoint: ${error.endpoint ?? XAI_OAUTH_TOKEN_URL}`,
    `Status HTTP: ${error.status == null ? "sem resposta" : error.status}`,
    `Código: ${error.oauthCode || error.code}`,
  ];
  if (error.oauthCode && error.oauthCode !== error.code) {
    lines.push(`Código interno: ${error.code}`);
  }
  if (error.description) {
    lines.push(`Descrição da xAI: ${redactSecrets(error.description)}`);
  }
  if (error.transportMessage) {
    lines.push(`Erro de transporte: ${redactSecrets(error.transportMessage)}`);
  }
  lines.push(`Tentativas de polling: ${error.attempts ?? 0}`);
  if (error.at) {
    lines.push(`Horário: ${new Date(error.at).toLocaleString("pt-BR")}`);
  }
  const events = error.events ?? [];
  if (events.length) {
    lines.push(`Log (${events.length} eventos):`);
    for (const event of events) {
      const code = event.oauthCode ? ` (${event.oauthCode})` : "";
      const status = event.status == null ? "" : ` HTTP ${event.status}`;
      lines.push(
        `  ${formatEventTime(event.at)} · ${event.kind}${status}${code} · ${redactSecrets(event.message)}`,
      );
    }
  }
  return lines;
}

/** Status em que vale a pena tentar de novo (inclui 0 = sem resposta). */
function isTransientStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function positiveNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/** Corpo do pedido de código (form urlencoded, como a xAI documenta). */
export function buildDeviceCodeBody(clientId = XAI_OAUTH_CLIENT_ID): string {
  return new URLSearchParams({ client_id: clientId, scope: XAI_OAUTH_SCOPE }).toString();
}

export function buildTokenPollBody(deviceCode: string, clientId = XAI_OAUTH_CLIENT_ID): string {
  return new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: clientId,
    device_code: deviceCode,
  }).toString();
}

export function buildRefreshBody(refreshToken: string, clientId = XAI_OAUTH_CLIENT_ID): string {
  return new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
  }).toString();
}

/** `verification_uri_complete` é opcional na RFC; cai no `verification_uri`. */
export function parseDeviceCode(data: unknown): DeviceCode {
  if (!data || typeof data !== "object") {
    throw new XaiAuthError(xaiAuthMessage("invalid_response"), "invalid_response");
  }
  const row = data as Record<string, unknown>;
  const deviceCode = text(row.device_code);
  const userCode = text(row.user_code);
  const verificationUri = text(row.verification_uri);
  const verificationUriComplete = text(row.verification_uri_complete) || verificationUri;
  if (!deviceCode || !userCode || !verificationUri) {
    throw new XaiAuthError(xaiAuthMessage("invalid_response"), "invalid_response");
  }
  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete,
    expiresInSeconds: Math.max(1, Math.round(positiveNumber(row.expires_in, 600))),
    // A RFC pede 5 s quando o servidor não manda `interval`.
    intervalSeconds: Math.max(1, Math.round(positiveNumber(row.interval, 5))),
  };
}

/** Código de erro do corpo `{ error, error_description }` (ou `error.code`). */
export function authErrorCode(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const row = data as Record<string, unknown>;
  const direct = text(row.error);
  if (direct) return direct;
  const nested = row.error;
  if (nested && typeof nested === "object") {
    return text((nested as { code?: unknown }).code);
  }
  return text(row.code);
}

/** Normaliza a resposta de token; mantém o refresh antigo quando não vem um novo. */
export function parseTokenResponse(
  data: unknown,
  now: number,
  previousRefreshToken = "",
): XaiTokens {
  if (!data || typeof data !== "object") {
    throw new XaiAuthError(xaiAuthMessage("invalid_response"), "invalid_response");
  }
  const row = data as Record<string, unknown>;
  const accessToken = text(row.access_token);
  const refreshToken = text(row.refresh_token) || previousRefreshToken.trim();
  if (!accessToken) {
    throw new XaiAuthError(xaiAuthMessage("invalid_response"), "invalid_response");
  }
  const expiresIn = Number(row.expires_in);
  return {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Math.round(now + expiresIn * 1000) : 0,
    tokenType: text(row.token_type) || "Bearer",
    scope: text(row.scope),
  };
}

function httpErrorFor(status: number, details: XaiAuthErrorOptions = {}): XaiAuthError {
  const base = { status, ...details };
  if (status === 401 || status === 403) {
    return new XaiAuthError(xaiAuthMessage("unauthorized"), "unauthorized", base);
  }
  if (status === 429) {
    return new XaiAuthError(xaiAuthMessage("rate_limit"), "rate_limit", base);
  }
  if (status >= 500) {
    return new XaiAuthError(xaiAuthMessage("server"), "server", base);
  }
  return new XaiAuthError(xaiAuthMessage("unknown"), "unknown", base);
}

/** Pedido inicial: devolve o código para mostrar e o `device_code` do polling. */
export async function requestDeviceCode(
  transport: AuthTransport,
  options: {
    clientId?: string;
    timeoutMs?: number;
    diagnostics?: AuthDiagnostics;
  } = {},
): Promise<DeviceCode> {
  const diagnostics = options.diagnostics;
  diagnostics?.add("device-code", "Pedido de código de dispositivo enviado");
  let response: AuthHttpResponse;
  try {
    response = await transport({
      method: "POST",
      url: XAI_OAUTH_DEVICE_CODE_URL,
      headers: FORM_HEADERS,
      body: buildDeviceCodeBody(options.clientId),
      timeoutMs: options.timeoutMs,
    });
  } catch (error) {
    const transportMessage = transportErrorMessage(error);
    diagnostics?.add("error", `Falha de transporte ao pedir o código: ${transportMessage}`);
    throw new XaiAuthError(xaiAuthMessage("network"), "network", {
      endpoint: XAI_OAUTH_DEVICE_CODE_URL,
      transportMessage,
      attempts: 1,
      at: Date.now(),
      events: diagnostics?.list(),
    });
  }
  if (response.status < 200 || response.status >= 300) {
    const code = authErrorCode(response.data);
    const description = authErrorDescription(response.data);
    const details: XaiAuthErrorOptions = {
      endpoint: XAI_OAUTH_DEVICE_CODE_URL,
      status: response.status,
      ...(code ? { oauthCode: code } : {}),
      ...(description ? { description } : {}),
      attempts: 1,
      at: Date.now(),
    };
    diagnostics?.add(
      "error",
      `Pedido de código recusado: HTTP ${response.status}${code ? ` (${code})` : ""}`,
      { status: response.status, ...(code ? { oauthCode: code } : {}) },
    );
    const withEvents = { ...details, events: diagnostics?.list() };
    if (code === "invalid_client" || code === "unauthorized_client") {
      throw new XaiAuthError(
        "A xAI bloqueou o login experimental do Grok CLI. Use a chave de API.",
        "invalid_request",
        withEvents,
      );
    }
    const mapped = httpErrorFor(response.status, details);
    throw new XaiAuthError(mapped.message, mapped.code, withEvents);
  }
  const code = parseDeviceCode(response.data);
  diagnostics?.add(
    "device-code",
    `Código recebido: expira em ${code.expiresInSeconds}s, intervalo ${code.intervalSeconds}s`,
  );
  return code;
}

/** Espera injetável; resolve antes quando o `AbortSignal` é abortado. */
export type SleepFn = (ms: number, signal?: AbortSignal) => Promise<void>;

const ABORTED_SIGNAL = (() => {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
})();

/**
 * "Acordar" o polling: no APK o WebView pausa em segundo plano e os timers
 * congelam. `wake()` interrompe o sleep atual para o próximo poll sair já —
 * usado no `appStateChange` (ou `visibilitychange` na web).
 */
export class PollWake {
  private controller = new AbortController();
  private pending = false;
  private waiting = false;

  wake = (): void => {
    if (this.waiting) {
      this.waiting = false;
      this.controller.abort();
      this.controller = new AbortController();
      return;
    }
    this.pending = true;
  };

  /** @internal — uma espera; o `sleep` resolve antes quando há wake. */
  async wait(ms: number, sleep: SleepFn): Promise<void> {
    const immediate = this.pending;
    this.pending = false;
    if (!immediate) this.waiting = true;
    try {
      await sleep(ms, immediate ? ABORTED_SIGNAL : this.controller.signal);
    } finally {
      this.waiting = false;
    }
  }
}

const defaultSleep: SleepFn = (ms, signal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener("abort", finish, { once: true });
  });

export type PollOptions = {
  deviceCode: string;
  /** Intervalo inicial devolvido pelo servidor (segundos). */
  intervalSeconds: number;
  /** Validade do código (segundos). */
  expiresInSeconds: number;
  clientId?: string;
  /** Injetado nos testes; respeita o `AbortSignal` do wake. */
  sleep?: SleepFn;
  /** Relógio real injetável nos testes (não é a soma dos sleeps). */
  now?: () => number;
  /** Injetado nos testes. */
  wake?: PollWake;
  /** Log em memória mostrado nos "Detalhes". */
  diagnostics?: AuthDiagnostics;
  /** Falhas transitórias consecutivas antes de desistir (padrão 6). */
  maxConsecutiveFailures?: number;
  timeoutMs?: number;
  /** Chamado a cada `slow_down` (ou 429) para a UI mostrar "aguardando mais". */
  onSlowDown?: (intervalSeconds: number) => void;
  /** A UI chama `true` ao fechar/cancelar para interromper o polling. */
  isCancelled?: () => boolean;
};

const DEFAULT_MAX_CONSECUTIVE_FAILURES = 6;
const MAX_BACKOFF_MS = 30_000;

/** Backoff exponencial a partir do intervalo atual, limitado a 30 s. */
function nextBackoff(intervalMs: number, failures: number): number {
  return Math.min(MAX_BACKOFF_MS, Math.max(1000, intervalMs) * 2 ** Math.max(1, failures));
}

/**
 * Polling do token até autorizar. Trata os códigos da RFC:
 * `authorization_pending` continua, `slow_down` (e 429) soma 5 s ao intervalo,
 * `expired_token`/`access_denied` encerram com erro.
 *
 * Falha transitória (exceção do transporte, status 0, 408, 429 ou 5xx) não
 * mata o login: conta como tentativa falha, aplica backoff (até 30 s) e só
 * aborta após `maxConsecutiveFailures` seguidas. O prazo é medido pelo relógio
 * real (`now()`), não pela soma dos sleeps.
 */
export async function pollDeviceToken(
  transport: AuthTransport,
  options: PollOptions,
): Promise<XaiTokens> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const diagnostics = options.diagnostics;
  const wake = options.wake ?? new PollWake();
  const maxFailures = Math.max(
    1,
    Math.round(options.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_FAILURES),
  );
  const startedAt = now();
  const deadlineAt = startedAt + Math.max(1, Math.round(options.expiresInSeconds)) * 1000;
  let intervalMs = Math.max(1000, Math.round(options.intervalSeconds) * 1000);
  let backoffMs = 0;
  let consecutiveFailures = 0;
  let attempts = 0;

  const fail = (
    message: string,
    code: XaiAuthErrorCode,
    extra: XaiAuthErrorOptions = {},
  ): XaiAuthError => {
    diagnostics?.add("error", `${code}: ${message}`, {
      ...(extra.status == null ? {} : { status: extra.status }),
      ...(extra.oauthCode ? { oauthCode: extra.oauthCode } : {}),
    });
    return new XaiAuthError(message, code, {
      endpoint: XAI_OAUTH_TOKEN_URL,
      attempts,
      at: now(),
      ...extra,
      events: diagnostics?.list() ?? [],
    });
  };

  const cancelled = () =>
    new XaiAuthError(xaiAuthMessage("cancelled"), "cancelled", {
      endpoint: XAI_OAUTH_TOKEN_URL,
      attempts,
      at: now(),
      events: diagnostics?.list() ?? [],
    });

  while (true) {
    if (options.isCancelled?.()) throw cancelled();

    const remainingMs = deadlineAt - now();
    if (remainingMs <= 0) break;
    const waitMs = Math.max(intervalMs, backoffMs);
    // Não adianta dormir mais do que a validade do código.
    if (waitMs > remainingMs) break;

    await wake.wait(waitMs, sleep);
    if (options.isCancelled?.()) throw cancelled();
    // O relógio real pode ter avançado além do prazo durante o sleep/pausa.
    if (now() >= deadlineAt) break;

    attempts += 1;
    let response: AuthHttpResponse;
    try {
      response = await transport({
        method: "POST",
        url: XAI_OAUTH_TOKEN_URL,
        headers: FORM_HEADERS,
        body: buildTokenPollBody(options.deviceCode, options.clientId),
        timeoutMs: options.timeoutMs,
      });
    } catch (error) {
      const transportMessage = transportErrorMessage(error);
      consecutiveFailures += 1;
      diagnostics?.add(
        "transient",
        `Poll ${attempts}: falha de transporte ${consecutiveFailures}/${maxFailures} (${transportMessage})`,
      );
      if (consecutiveFailures >= maxFailures) {
        throw fail(xaiAuthMessage("network"), "network", {
          transportMessage,
          attempts,
        });
      }
      backoffMs = nextBackoff(intervalMs, consecutiveFailures);
      continue;
    }

    if (response.status >= 200 && response.status < 300) {
      const tokens = parseTokenResponse(response.data, now());
      diagnostics?.add("success", `Poll ${attempts}: token recebido`);
      return tokens;
    }

    const code = authErrorCode(response.data);
    const description = authErrorDescription(response.data);
    diagnostics?.add(
      "poll",
      `Poll ${attempts}: HTTP ${response.status}${code ? ` (${code})` : ""}`,
      { status: response.status, ...(code ? { oauthCode: code } : {}) },
    );
    const details: XaiAuthErrorOptions = {
      status: response.status,
      ...(code ? { oauthCode: code } : {}),
      ...(description ? { description } : {}),
    };

    if (code === "authorization_pending") {
      consecutiveFailures = 0;
      backoffMs = 0;
      continue;
    }

    if (code === "slow_down") {
      intervalMs = Math.min(MAX_BACKOFF_MS, intervalMs + 5000);
      consecutiveFailures = 0;
      backoffMs = 0;
      options.onSlowDown?.(Math.round(intervalMs / 1000));
      continue;
    }

    if (code === "expired_token") {
      throw fail(xaiAuthMessage("expired_token"), "expired_token", details);
    }
    if (code === "access_denied") {
      throw fail(xaiAuthMessage("access_denied"), "access_denied", details);
    }
    if (code === "invalid_grant") {
      throw fail(xaiAuthMessage("invalid_grant"), "invalid_grant", details);
    }
    if (code === "invalid_request" || code === "invalid_client") {
      throw fail(
        "A xAI recusou o login experimental. Use a chave de API.",
        "invalid_request",
        details,
      );
    }

    if (isTransientStatus(response.status)) {
      consecutiveFailures += 1;
      if (response.status === 429) {
        // 429 da xAI é "devagar": aumenta o intervalo como um slow_down.
        intervalMs = Math.min(MAX_BACKOFF_MS, intervalMs + 5000);
        backoffMs = 0;
        options.onSlowDown?.(Math.round(intervalMs / 1000));
      }
      diagnostics?.add(
        "transient",
        `Poll ${attempts}: falha transitória ${consecutiveFailures}/${maxFailures} (HTTP ${response.status}${code ? `, ${code}` : ""})`,
        { status: response.status, ...(code ? { oauthCode: code } : {}) },
      );
      if (consecutiveFailures >= maxFailures) {
        if (response.status === 429) {
          throw fail(xaiAuthMessage("rate_limit"), "rate_limit", details);
        }
        if (response.status >= 500) {
          throw fail(xaiAuthMessage("server"), "server", details);
        }
        throw fail(xaiAuthMessage("network"), "network", details);
      }
      if (response.status !== 429) {
        backoffMs = nextBackoff(intervalMs, consecutiveFailures);
      }
      continue;
    }

    throw fail(httpErrorFor(response.status).message, httpErrorFor(response.status).code, details);
  }

  throw fail(xaiAuthMessage("expired_token"), "expired_token");
}

/** Renova o access token; em `invalid_grant` a pessoa precisa entrar de novo. */
export async function refreshAccessToken(
  transport: AuthTransport,
  refreshToken: string,
  options: { clientId?: string; now?: number } = {},
): Promise<XaiTokens> {
  let response: AuthHttpResponse;
  try {
    response = await transport({
      method: "POST",
      url: XAI_OAUTH_TOKEN_URL,
      headers: FORM_HEADERS,
      body: buildRefreshBody(refreshToken, options.clientId),
    });
  } catch (error) {
    throw new XaiAuthError(xaiAuthMessage("network"), "network", {
      endpoint: XAI_OAUTH_TOKEN_URL,
      transportMessage: transportErrorMessage(error),
      attempts: 1,
      at: Date.now(),
    });
  }

  if (response.status >= 200 && response.status < 300) {
    return parseTokenResponse(response.data, options.now ?? Date.now(), refreshToken);
  }

  const code = authErrorCode(response.data);
  const description = authErrorDescription(response.data);
  const details: XaiAuthErrorOptions = {
    endpoint: XAI_OAUTH_TOKEN_URL,
    status: response.status,
    ...(code ? { oauthCode: code } : {}),
    ...(description ? { description } : {}),
    attempts: 1,
    at: Date.now(),
  };
  if (code === "invalid_grant" || code === "expired_token") {
    throw new XaiAuthError(xaiAuthMessage("invalid_grant"), "invalid_grant", details);
  }
  const mapped = httpErrorFor(response.status, details);
  throw new XaiAuthError(mapped.message, mapped.code, details);
}

/** Margem antes de expirar para renovar em segundo plano. */
export const REFRESH_SKEW_MS = 60_000;

/** `true` quando o access token já venceu (ou está a menos de 1 min). */
export function needsRefresh(tokens: XaiTokens | null, now: number): boolean {
  if (!tokens) return false;
  if (!tokens.expiresAt) return false;
  return tokens.expiresAt - now <= REFRESH_SKEW_MS;
}

/** Valida o JSON guardado no cofre (não confia em campo faltando). */
export function parseStoredTokens(raw: unknown): XaiTokens | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const accessToken = text(row.accessToken);
  if (!accessToken) return null;
  const expiresAt = Number(row.expiresAt);
  return {
    accessToken,
    refreshToken: text(row.refreshToken),
    expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? Math.round(expiresAt) : 0,
    tokenType: text(row.tokenType) || "Bearer",
    scope: text(row.scope),
  };
}
