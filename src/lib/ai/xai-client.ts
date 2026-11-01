import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { getKey, type KeyName } from "../secure/keys.ts";
import type { ResearcherId } from "../study/types.ts";
import { generateBlockPackage } from "./package.functions.ts";
import type { AiResult, CoreDeps, TextRequest } from "./core.ts";
import {
  runGenerateBlockPackage,
  runGeneratePackage,
  runPingAi,
  runResearchAdd,
  runTutorTurn,
  type GenerateBlockInput,
  type GeneratePackageInput,
  type PingInput,
  type ResearchInput,
  type TutorInput,
} from "./core.ts";
import {
  AiRequestError,
  emptyError,
  failureOf,
  httpError,
  transportFailure,
} from "./errors.ts";
import { commonsImages, type JsonFetcher } from "./images.ts";
import { FAST_MODEL, SEARCH_MODEL } from "./models.ts";
import type { PackageBody } from "./parse.ts";
import {
  buildProfessorSystemPrompt,
  normalizeProfessorHistory,
  type ProfessorMessage,
} from "./prompts.ts";
import { generatePackage, pingAi, researchAdd, tutorTurn } from "./study.functions.ts";

/**
 * Cliente de IA do app.
 *
 * - Web/Vercel: continua chamando as server functions (a chave de ambiente
 *   fica no servidor).
 * - APK/Android: não existe servidor, então o mesmo `core.ts` roda no cliente
 *   e fala direto com a xAI por `CapacitorHttp`, com a chave do cofre seguro
 *   (`src/lib/secure/keys.ts`).
 *
 * Limitação documentada: CapacitorHttp não entrega resposta em stream. O chat
 * do professor no APK recebe a resposta completa de uma vez (`stream: false`);
 * na web o caminho com `/api/professor` continua em streaming.
 */

const LABELS: Record<ResearcherId, string> = {
  grok: "xAI",
  perplexity: "Perplexity",
  gemini: "Gemini",
  claude: "Claude",
};

const KEY_NAMES: Record<ResearcherId, KeyName> = {
  grok: "xai",
  perplexity: "perplexity",
  gemini: "gemini",
  claude: "claude",
};

/**
 * Todo pedido de IA tem 15 s para conectar e para responder nos fluxos
 * interativos (teste de conexão, tutor, professor). A geração de um pacote
 * completo continua com um teto maior: 15 s cortaria a aula no meio.
 */
const AI_CONNECT_TIMEOUT = 15000;
const QUICK_TIMEOUT = 15000;
const SEARCH_TIMEOUT = 90000;
const GENERATE_TIMEOUT = 90000;
const PROFESSOR_TIMEOUT = 15000;

export function isNativeAi(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function authHeader(key: string): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

async function nativeKey(provider: ResearcherId, userKey?: string): Promise<string> {
  const direct = (userKey ?? "").trim();
  if (direct) return direct;
  try {
    return (await getKey(KEY_NAMES[provider])).trim();
  } catch {
    return "";
  }
}

type NativeResponse = { status: number; data: unknown; headers: Record<string, string> };

function normalizeHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== "object") return out;
  for (const [name, value] of Object.entries(headers as Record<string, unknown>)) {
    out[name.toLowerCase()] = String(value ?? "");
  }
  return out;
}

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

async function nativeRequest(options: {
  method: "GET" | "POST";
  url: string;
  headers?: Record<string, string>;
  data?: unknown;
  readTimeout?: number;
  connectTimeout?: number;
}): Promise<NativeResponse> {
  try {
    const response = await CapacitorHttp.request({
      url: options.url,
      method: options.method,
      headers: options.headers,
      data: options.data,
      responseType: "json",
      connectTimeout: options.connectTimeout ?? AI_CONNECT_TIMEOUT,
      readTimeout: options.readTimeout ?? QUICK_TIMEOUT,
    });
    return {
      status: typeof response.status === "number" ? response.status : 0,
      data: normalizeData(response.data),
      headers: normalizeHeaders(response.headers),
    };
  } catch (error) {
    throw transportFailure(error, { online: isOnline() });
  }
}

function bodyText(data: unknown): string {
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data ?? "");
  } catch {
    return "";
  }
}

function requireOk(response: NativeResponse, provider: ResearcherId): void {
  if (response.status >= 200 && response.status < 300) return;
  throw httpError(response.status, bodyText(response.data), {
    retryAfter: response.headers["retry-after"],
    providerLabel: LABELS[provider],
  });
}

function textFromChat(data: unknown): string {
  const body = data as { choices?: { message?: { content?: string } }[] } | null;
  return body?.choices?.[0]?.message?.content ?? "";
}

async function xaiChat(options: {
  key: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  maxTokens: number;
  temperature?: number;
  json?: boolean;
  readTimeout?: number;
}): Promise<string> {
  const response = await nativeRequest({
    method: "POST",
    url: "https://api.x.ai/v1/chat/completions",
    headers: authHeader(options.key),
    data: {
      model: FAST_MODEL,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens,
      ...(options.json === false ? {} : { response_format: { type: "json_object" } }),
      // CapacitorHttp não suporta SSE: a resposta vem completa.
      stream: false,
      messages: options.messages,
    },
    readTimeout:
      options.readTimeout ??
      (options.maxTokens > 1500 ? GENERATE_TIMEOUT : QUICK_TIMEOUT),
  });
  requireOk(response, "grok");
  const text = textFromChat(response.data);
  if (!text.trim()) throw emptyError();
  return text;
}

async function xaiSearch(key: string, prompt: string): Promise<string> {
  const response = await nativeRequest({
    method: "POST",
    url: "https://api.x.ai/v1/responses",
    headers: authHeader(key),
    data: {
      model: SEARCH_MODEL,
      reasoning: { effort: "low" },
      max_output_tokens: 3500,
      tools: [{ type: "web_search" }],
      text: { format: { type: "json_object" } },
      input: [{ role: "user", content: prompt }],
    },
    readTimeout: SEARCH_TIMEOUT,
  });
  requireOk(response, "grok");
  const body = response.data as {
    output?: { content?: { type?: string; text?: string }[] }[];
  } | null;
  let text = "";
  for (const item of body?.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) text += part.text;
    }
  }
  if (!text.trim()) throw emptyError("A pesquisa não devolveu texto.");
  return text;
}

async function nativeProviderChat(
  provider: ResearcherId,
  key: string,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  if (provider === "perplexity") {
    const response = await nativeRequest({
      method: "POST",
      url: "https://api.perplexity.ai/chat/completions",
      headers: authHeader(key),
      data: {
        model: "sonar",
        temperature: 0.3,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      },
      readTimeout: maxTokens > 1500 ? GENERATE_TIMEOUT : QUICK_TIMEOUT,
    });
    requireOk(response, provider);
    const text = textFromChat(response.data);
    if (!text.trim()) throw emptyError();
    return text;
  }

  if (provider === "gemini") {
    const response = await nativeRequest({
      method: "POST",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      headers: { "Content-Type": "application/json" },
      data: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      },
      readTimeout: maxTokens > 1500 ? GENERATE_TIMEOUT : QUICK_TIMEOUT,
    });
    requireOk(response, provider);
    const body = response.data as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    } | null;
    const text =
      body?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) throw emptyError();
    return text;
  }

  const response = await nativeRequest({
    method: "POST",
    url: "https://api.anthropic.com/v1/messages",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    data: {
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    },
    readTimeout: maxTokens > 1500 ? GENERATE_TIMEOUT : QUICK_TIMEOUT,
  });
  requireOk(response, provider);
  const body = response.data as { content?: { text?: string }[] } | null;
  const text = body?.content?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) throw emptyError();
  return text;
}

async function nativeText(request: TextRequest): Promise<{ text: string; webSearch: boolean }> {
  if (request.webSearch) {
    try {
      return { text: await xaiSearch(request.key, request.prompt), webSearch: true };
    } catch {
      // Se a pesquisa falhar, mantém o comportamento antigo: tenta o chat.
    }
  }
  if (request.provider === "grok") {
    return {
      text: await xaiChat({
        key: request.key,
        messages: [{ role: "user", content: request.prompt }],
        maxTokens: request.maxTokens,
      }),
      webSearch: false,
    };
  }
  return {
    text: await nativeProviderChat(
      request.provider,
      request.key,
      request.prompt,
      request.maxTokens,
    ),
    webSearch: false,
  };
}

const nativeGetJson: JsonFetcher = async (url, timeoutMs) => {
  const response = await nativeRequest({ method: "GET", url, readTimeout: timeoutMs });
  if (response.status < 200 || response.status >= 300) {
    throw httpError(response.status, bodyText(response.data), { providerLabel: "Wikimedia" });
  }
  return response.data;
};

const nativeDeps: CoreDeps = {
  resolveKey: (_provider, userKey) => userKey.trim() || null,
  noKeyMessage: (provider) =>
    provider === "grok"
      ? "Sem chave da xAI. Cole a sua chave em Ajustes."
      : `Sem chave do ${LABELS[provider]}. Coloque a chave em Ajustes.`,
  text: nativeText,
  images: (queries) => commonsImages(queries, nativeGetJson).catch(() => []),
  isOnline,
};

/* ------------------------------ API usada pela UI ------------------------------ */

/**
 * Na web a chamada é uma server function. Falha de rede/rota não pode escapar
 * como `TypeError` cru: vira o mesmo `AiResult` com mensagem em português.
 */
async function webResult<T>(call: () => Promise<AiResult<T>>): Promise<AiResult<T>> {
  try {
    return await call();
  } catch (error) {
    const failure = failureOf(error, { online: isOnline() });
    return { ok: false, error: failure.message, failure };
  }
}

export async function generatePackageClient(
  input: GeneratePackageInput,
): Promise<AiResult<PackageBody>> {
  if (!isNativeAi()) return webResult(() => generatePackage({ data: input }));
  const userKey = await nativeKey(input.provider, input.userKey);
  return runGeneratePackage({ ...input, userKey }, nativeDeps);
}

export async function generateBlockPackageClient(input: GenerateBlockInput) {
  if (!isNativeAi()) return webResult(() => generateBlockPackage({ data: input }));
  const userKey = await nativeKey("grok", input.userKey);
  return runGenerateBlockPackage({ ...input, userKey }, nativeDeps);
}

export async function researchAddClient(input: ResearchInput) {
  if (!isNativeAi()) return webResult(() => researchAdd({ data: input }));
  const userKey = await nativeKey("grok", input.userKey);
  return runResearchAdd({ ...input, userKey }, nativeDeps);
}

export async function pingAiClient(input: PingInput) {
  if (!isNativeAi()) return webResult(() => pingAi({ data: input }));
  const userKey = await nativeKey(input.provider, input.userKey);
  return runPingAi({ ...input, userKey }, nativeDeps);
}

export async function tutorTurnClient(input: TutorInput) {
  if (!isNativeAi()) return webResult(() => tutorTurn({ data: input }));
  const userKey = await nativeKey("grok", input.userKey);
  return runTutorTurn({ ...input, userKey }, nativeDeps);
}

/* ------------------------------ Chat do professor ------------------------------ */

export type ProfessorInput = {
  topic: string;
  subtopic: string;
  brief: string;
  question: string;
  holdAnswer: boolean;
  mistakes: string[];
  userKey: string;
  messages: ProfessorMessage[];
};

/**
 * Resposta completa (sem stream) do professor no APK. A UI aplica o mesmo
 * `present()` da web depois de receber o texto inteiro.
 */
export async function nativeProfessorReply(input: ProfessorInput): Promise<string> {
  const key = await nativeKey("grok", input.userKey);
  if (!key)
    throw new AiRequestError("Sem chave da xAI. Cole a sua chave em Ajustes.", "missing-key");
  const history = normalizeProfessorHistory(input.messages);
  if (!history.length) throw new AiRequestError("Escreva a dúvida primeiro.", "bad-request");
  return xaiChat({
    key,
    messages: [{ role: "system", content: buildProfessorSystemPrompt(input) }, ...history],
    maxTokens: 700,
    temperature: 0.3,
    json: false,
    readTimeout: PROFESSOR_TIMEOUT,
  });
}
