/**
 * Transporte real do OpenRouter.
 *
 * No APK (Capacitor) usa `CapacitorHttp`, que fala com a rede pelo lado nativo:
 * sem CORS e sem o bloqueio do `fetch` da WebView a cabeçalhos como
 * `HTTP-Referer`. Na web/Vercel usa `fetch` normal, removendo `HTTP-Referer`
 * (a atribuição continua no `X-Title`, que o OpenRouter também aceita).
 *
 * Não há chave embutida: a chave chega por parâmetro, vinda do cofre seguro.
 */

import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { transportFailure } from "../errors.ts";
import type { HttpRequest, HttpResponse, HttpTransport } from "./client.ts";
import { DEFAULT_TIMEOUT_MS } from "./client.ts";

const CONNECT_TIMEOUT_MS = 15000;

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** Cabeçalhos em minúsculas, como no resto do cliente nativo da xAI. */
function normalizeHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== "object") return out;
  for (const [name, value] of Object.entries(headers as Record<string, unknown>)) {
    out[name.toLowerCase()] = String(value ?? "");
  }
  return out;
}

/** `CapacitorHttp` às vezes entrega JSON como texto; converte quando dá. */
function normalizeData(data: unknown): unknown {
  if (typeof data !== "string") return data;
  const trimmed = data.trim();
  if (!trimmed) return data;
  const looksJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));
  if (!looksJson) return data;
  try {
    return JSON.parse(trimmed);
  } catch {
    return data;
  }
}

/** Transporte nativo. Exportado para a UI/testes manuais poderem simular. */
export const capacitorTransport: HttpTransport = async (request: HttpRequest) => {
  try {
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
  } catch (error) {
    throw transportFailure(error, { online: isOnline() });
  }
};

/**
 * `Referer`/`HTTP-Referer` e outros cabeçalhos do navegador são proibidos pelo
 * `fetch` da WebView. Na web o `X-Title` mantém a atribuição do app.
 */
const WEB_BLOCKED_HEADERS = new Set(["http-referer", "referer"]);

export function webHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!WEB_BLOCKED_HEADERS.has(name.toLowerCase())) out[name] = value;
  }
  return out;
}

function parseBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return text;
  try {
    return JSON.parse(trimmed);
  } catch {
    return text;
  }
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, name) => {
    out[name.toLowerCase()] = value;
  });
  return out;
}

/** Transporte web. Exportado para o caminho de desenvolvimento/testes. */
export const fetchTransport: HttpTransport = async (request: HttpRequest) => {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(
    () => controller?.abort(),
    Math.max(1000, request.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  );
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: webHeaders(request.headers),
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      ...(controller ? { signal: controller.signal } : {}),
    });
    return {
      status: response.status,
      data: parseBody(await response.text()),
      headers: headersToObject(response.headers),
    };
  } catch (error) {
    throw transportFailure(error, { online: isOnline() });
  } finally {
    clearTimeout(timer);
  }
};

/** Transporte do ambiente atual: nativo no APK, `fetch` na web. */
export function defaultTransport(): HttpTransport {
  return isNativePlatform() ? capacitorTransport : fetchTransport;
}
