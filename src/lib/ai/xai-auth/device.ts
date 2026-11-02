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

/** Erro do login experimental, com o código devolvido pela xAI. */
export class XaiAuthError extends Error {
  readonly code: XaiAuthErrorCode;
  readonly status?: number;

  constructor(message: string, code: XaiAuthErrorCode = "unknown", status?: number) {
    super(message);
    this.name = "XaiAuthError";
    this.code = code;
    this.status = status;
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

function positiveNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/** Corpo do pedido de código (form urlencoded, como a xAI documenta). */
export function buildDeviceCodeBody(clientId = XAI_OAUTH_CLIENT_ID): string {
  return new URLSearchParams({ client_id: clientId, scope: XAI_OAUTH_SCOPE }).toString();
}

export function buildTokenPollBody(
  deviceCode: string,
  clientId = XAI_OAUTH_CLIENT_ID,
): string {
  return new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: clientId,
    device_code: deviceCode,
  }).toString();
}

export function buildRefreshBody(
  refreshToken: string,
  clientId = XAI_OAUTH_CLIENT_ID,
): string {
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
    expiresAt:
      Number.isFinite(expiresIn) && expiresIn > 0
        ? Math.round(now + expiresIn * 1000)
        : 0,
    tokenType: text(row.token_type) || "Bearer",
    scope: text(row.scope),
  };
}

function httpErrorFor(status: number): XaiAuthError {
  if (status === 401 || status === 403) {
    return new XaiAuthError(xaiAuthMessage("unauthorized"), "unauthorized", status);
  }
  if (status === 429) {
    return new XaiAuthError(xaiAuthMessage("rate_limit"), "rate_limit", status);
  }
  if (status >= 500) {
    return new XaiAuthError(xaiAuthMessage("server"), "server", status);
  }
  return new XaiAuthError(xaiAuthMessage("unknown"), "unknown", status);
}

/** Pedido inicial: devolve o código para mostrar e o `device_code` do polling. */
export async function requestDeviceCode(
  transport: AuthTransport,
  options: { clientId?: string; timeoutMs?: number } = {},
): Promise<DeviceCode> {
  let response: AuthHttpResponse;
  try {
    response = await transport({
      method: "POST",
      url: XAI_OAUTH_DEVICE_CODE_URL,
      headers: FORM_HEADERS,
      body: buildDeviceCodeBody(options.clientId),
      timeoutMs: options.timeoutMs,
    });
  } catch {
    throw new XaiAuthError(xaiAuthMessage("network"), "network");
  }
  if (response.status < 200 || response.status >= 300) {
    const code = authErrorCode(response.data);
    if (code === "invalid_client" || code === "unauthorized_client") {
      throw new XaiAuthError(
        "A xAI bloqueou o login experimental do Grok CLI. Use a chave de API.",
        "invalid_request",
        response.status,
      );
    }
    throw httpErrorFor(response.status);
  }
  return parseDeviceCode(response.data);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type PollOptions = {
  deviceCode: string;
  /** Intervalo inicial devolvido pelo servidor (segundos). */
  intervalSeconds: number;
  /** Validade do código (segundos). */
  expiresInSeconds: number;
  clientId?: string;
  /** Injetado nos testes. */
  sleep?: (ms: number) => Promise<void>;
  /** Injetado nos testes para o `expiresAt` dos tokens. */
  now?: number;
  /** Chamado a cada `slow_down` para a UI mostrar "aguardando mais". */
  onSlowDown?: (intervalSeconds: number) => void;
  /** A UI chama `true` ao fechar/cancelar para interromper o polling. */
  isCancelled?: () => boolean;
};

/**
 * Polling do token até autorizar. Trata os códigos da RFC:
 * `authorization_pending` continua, `slow_down` soma 5 s ao intervalo,
 * `expired_token`/`access_denied` encerram com erro.
 */
export async function pollDeviceToken(
  transport: AuthTransport,
  options: PollOptions,
): Promise<XaiTokens> {
  const sleep = options.sleep ?? defaultSleep;
  let interval = Math.max(1, Math.round(options.intervalSeconds));
  let elapsed = 0;
  const deadline = Math.max(1, Math.round(options.expiresInSeconds));
  let attempts = 0;

  while (elapsed < deadline) {
    if (options.isCancelled?.()) {
      throw new XaiAuthError(xaiAuthMessage("cancelled"), "cancelled");
    }
    // Não adianta dormir mais do que a validade do código.
    if (elapsed + interval > deadline) break;
    await sleep(interval * 1000);
    if (options.isCancelled?.()) {
      throw new XaiAuthError(xaiAuthMessage("cancelled"), "cancelled");
    }
    elapsed += interval;
    attempts += 1;
    if (attempts > 500) break;

    let response: AuthHttpResponse;
    try {
      response = await transport({
        method: "POST",
        url: XAI_OAUTH_TOKEN_URL,
        headers: FORM_HEADERS,
        body: buildTokenPollBody(options.deviceCode, options.clientId),
      });
    } catch {
      throw new XaiAuthError(xaiAuthMessage("network"), "network");
    }

    if (response.status >= 200 && response.status < 300) {
      return parseTokenResponse(response.data, options.now ?? Date.now());
    }

    const code = authErrorCode(response.data);
    if (code === "authorization_pending") continue;
    if (code === "slow_down") {
      interval += 5;
      options.onSlowDown?.(interval);
      continue;
    }
    if (code === "expired_token") {
      throw new XaiAuthError(xaiAuthMessage("expired_token"), "expired_token", response.status);
    }
    if (code === "access_denied") {
      throw new XaiAuthError(xaiAuthMessage("access_denied"), "access_denied", response.status);
    }
    if (code === "invalid_grant") {
      throw new XaiAuthError(xaiAuthMessage("invalid_grant"), "invalid_grant", response.status);
    }
    if (code === "invalid_request" || code === "invalid_client") {
      throw new XaiAuthError(
        "A xAI recusou o login experimental. Use a chave de API.",
        "invalid_request",
        response.status,
      );
    }
    throw httpErrorFor(response.status);
  }

  throw new XaiAuthError(xaiAuthMessage("expired_token"), "expired_token");
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
  } catch {
    throw new XaiAuthError(xaiAuthMessage("network"), "network");
  }

  if (response.status >= 200 && response.status < 300) {
    return parseTokenResponse(response.data, options.now ?? Date.now(), refreshToken);
  }

  const code = authErrorCode(response.data);
  if (code === "invalid_grant" || code === "expired_token") {
    throw new XaiAuthError(xaiAuthMessage("invalid_grant"), "invalid_grant", response.status);
  }
  throw httpErrorFor(response.status);
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
