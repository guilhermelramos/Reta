/**
 * Transporte real do login experimental da xAI.
 *
 * No APK usa `CapacitorHttp` (a WebView bloqueia cabeçalhos e CORS em chamadas
 * diretas); na web usa `fetch`. O corpo já chega serializado como
 * `application/x-www-form-urlencoded` e não é reescrito.
 */

import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type {
  AuthHttpRequest,
  AuthHttpResponse,
  AuthTransport,
} from "./device.ts";

const CONNECT_TIMEOUT_MS = 15000;
const DEFAULT_TIMEOUT_MS = 20000;

export function isNativeAuth(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== "object") return out;
  for (const [name, value] of Object.entries(headers as Record<string, unknown>)) {
    out[name.toLowerCase()] = String(value ?? "");
  }
  return out;
}

/** CapacitorHttp pode devolver JSON como texto; converte só quando parece JSON. */
function normalizeData(data: unknown): unknown {
  if (typeof data !== "string") return data;
  const trimmed = data.trim();
  if (!trimmed) return data;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return data;
  try {
    return JSON.parse(trimmed);
  } catch {
    return data;
  }
}

export const capacitorAuthTransport: AuthTransport = async (request: AuthHttpRequest) => {
  const response = await CapacitorHttp.request({
    url: request.url,
    method: request.method,
    headers: request.headers,
    ...(request.body === undefined ? {} : { data: request.body }),
    responseType: "json",
    connectTimeout: CONNECT_TIMEOUT_MS,
    readTimeout: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  return {
    status: typeof response.status === "number" ? response.status : 0,
    data: normalizeData(response.data),
    headers: normalizeHeaders(response.headers),
  };
};

export const fetchAuthTransport: AuthTransport = async (request: AuthHttpRequest) => {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(
    () => controller?.abort(),
    Math.max(1000, request.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  );
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
      ...(controller ? { signal: controller.signal } : {}),
    });
    const raw = await response.text();
    let data: unknown = raw;
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        data = JSON.parse(trimmed) as unknown;
      } catch {
        data = raw;
      }
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });
    return { status: response.status, data, headers } satisfies AuthHttpResponse;
  } finally {
    clearTimeout(timer);
  }
};

/** Nativo no APK, `fetch` na web. */
export function defaultAuthTransport(): AuthTransport {
  return isNativeAuth() ? capacitorAuthTransport : fetchAuthTransport;
}

/**
 * Abre a página de verificação no navegador do sistema. No APK o Capacitor
 * encaminha `window.open` para fora do WebView; se o aparelho bloquear, a
 * própria tela mostra o link clicável como alternativa.
 */
export function openVerificationPage(url: string): boolean {
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    return opened != null || typeof window !== "undefined";
  } catch {
    return false;
  }
}
