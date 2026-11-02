import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { getKey, getOpenRouterKey, type KeyName } from "../secure/keys.ts";
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
import type { PackageBody, ResearchAddition } from "./parse.ts";
import type { AiBlockPackage } from "./block-package.ts";
import type { QuizItem } from "../study/types.ts";
import {
  normalizeAiRequestOptions,
  professorMessagesWithImages,
  promptMessage,
  providerChat,
  type AiRequestOptions,
  type ProviderMessage,
} from "./provider.ts";
import {
  buildProfessorSystemPrompt,
  normalizeProfessorHistory,
  type ProfessorMessage,
} from "./prompts.ts";
import { generatePackage, pingAi, researchAdd, tutorTurn } from "./study.functions.ts";
import { capacitorTransport, fetchTransport } from "./openrouter/transport.ts";

/**
 * Cliente de IA do app.
 *
 * - Web/Vercel: a xAI continua chamando as server functions (a chave de
 *   ambiente fica no servidor). O OpenRouter, que é BYOK, usa `fetch` direto
 *   do navegador — a chave vem do cofre (IndexedDB na web).
 * - APK/Android: não existe servidor. A xAI continua no `CapacitorHttp` e o
 *   OpenRouter também passa por ele (o `fetch` da WebView bloqueia
 *   `HTTP-Referer`); a chave vem do Keystore.
 *
 * Quem escolhe o provedor é `provider.ts`. Os prompts e o parse são os mesmos
 * em qualquer caminho.
 *
 * Limitação documentada: CapacitorHttp não entrega resposta em stream. O chat
 * do professor no APK recebe a resposta completa de uma vez (`stream: false`);
 * na web o caminho xAI com `/api/professor` continua em streaming. No
 * OpenRouter a resposta também chega completa (o transporte não usa SSE).
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

function openRouterKey(options: AiRequestOptions): Promise<string> {
  const direct = (options.openRouterKey ?? "").trim();
  if (direct) return Promise.resolve(direct);
  return getOpenRouterKey().catch(() => "");
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
    provider: provider === "grok" ? "xai" : undefined,
  });
}

function textFromChat(data: unknown): string {
  const body = data as { choices?: { message?: { content?: string } }[] } | null;
  return body?.choices?.[0]?.message?.content ?? "";
}

async function xaiChat(options: {
  key: string;
  messages: ProviderMessage[];
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

/**
 * Caminho xAI na web **só** quando há anexo de imagem (o `/api/professor`
 * antigo não transporta partes). Sem imagem, a web continua na server function.
 */
async function webXaiChat(options: {
  key: string;
  messages: ProviderMessage[];
  maxTokens: number;
  temperature?: number;
  json?: boolean;
  readTimeout?: number;
}): Promise<string> {
  const timeout = options.readTimeout ?? (options.maxTokens > 1500 ? GENERATE_TIMEOUT : QUICK_TIMEOUT);
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), Math.max(1000, timeout));
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: authHeader(options.key),
      body: JSON.stringify({
        model: FAST_MODEL,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens,
        ...(options.json === false ? {} : { response_format: { type: "json_object" } }),
        stream: false,
        messages: options.messages,
      }),
      ...(controller ? { signal: controller.signal } : {}),
    });
    const body = await response.text().catch(() => "");
    if (!response.ok) {
      throw httpError(response.status, body, {
        retryAfter: response.headers.get("retry-after"),
        providerLabel: "xAI",
        provider: "xai",
      });
    }
    const parsed = body.trim().startsWith("{") ? JSON.parse(body) : null;
    const text = textFromChat(parsed);
    if (!text.trim()) throw emptyError();
    return text;
  } catch (error) {
    throw transportFailure(error, { online: isOnline() });
  } finally {
    clearTimeout(timer);
  }
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

/** Texto no caminho nativo, com o provedor escolhido pela camada de rota. */
async function routedText(
  request: TextRequest,
  transport: "capacitor" | "fetch",
): Promise<{ text: string; webSearch: boolean }> {
  const ai = normalizeAiRequestOptions(request.ai);
  const xai = (input: {
    messages: ProviderMessage[];
    maxTokens: number;
    temperature?: number;
    json?: boolean;
    timeoutMs?: number;
  }) => {
    const call = {
      key: request.key,
      messages: input.messages,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      json: input.json,
      readTimeout: input.timeoutMs,
    };
    return transport === "capacitor" ? xaiChat(call) : webXaiChat(call);
  };

  if (ai.preferences.provider === "openrouter") {
    const text = await providerChat(
      {
        ...ai,
        openRouterKey: request.key,
        transport: transport === "capacitor" ? capacitorTransport : fetchTransport,
      },
      {
        messages: [promptMessage(request.prompt, request.images ?? [])],
        maxTokens: request.maxTokens,
        temperature: 0.3,
        json: request.json === true,
        timeoutMs: request.maxTokens > 1500 ? GENERATE_TIMEOUT : QUICK_TIMEOUT,
      },
      xai,
    );
    return { text, webSearch: false };
  }

  if (request.webSearch && !request.images?.length) {
    try {
      return { text: await xaiSearch(request.key, request.prompt), webSearch: true };
    } catch {
      // Se a pesquisa falhar, mantém o comportamento antigo: tenta o chat.
    }
  }
  if (request.provider === "grok" || request.images?.length) {
    return {
      text: await xai({
        messages: [promptMessage(request.prompt, request.images ?? [])],
        maxTokens: request.maxTokens,
        json: request.json !== false,
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

const webGetJson: JsonFetcher = async (url, timeoutMs) => {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), Math.max(1000, timeoutMs));
  try {
    const response = await fetch(url, controller ? { signal: controller.signal } : {});
    if (!response.ok) {
      throw httpError(response.status, "", { providerLabel: "Wikimedia" });
    }
    return (await response.json()) as unknown;
  } catch (error) {
    throw transportFailure(error, { online: isOnline() });
  } finally {
    clearTimeout(timer);
  }
};

function depsFor(transport: "capacitor" | "fetch"): CoreDeps {
  const native = transport === "capacitor";
  return {
    resolveKey: (_provider, userKey) => userKey.trim() || null,
    noKeyMessage: (provider) =>
      provider === "grok"
        ? "Sem chave da xAI. Cole a sua chave em Ajustes."
        : `Sem chave do ${LABELS[provider]}. Coloque a chave em Ajustes.`,
    text: (request) => routedText(request, transport),
    images: (queries) =>
      commonsImages(queries, native ? nativeGetJson : webGetJson).catch(() => []),
    isOnline,
  };
}

const nativeDeps: CoreDeps = depsFor("capacitor");
const webDeps: CoreDeps = depsFor("fetch");

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

/** Preferências + chave efetiva do provedor ativo. */
function aiOptions(input: { ai?: AiRequestOptions }): AiRequestOptions {
  return normalizeAiRequestOptions(input.ai);
}

/** O caminho de servidor da xAI não precisa receber preferências/catálogo/chave extra. */
function withoutAi<T extends { ai?: unknown }>(input: T): Omit<T, "ai"> {
  const { ai: _ai, ...rest } = input;
  return rest;
}

function wantsOpenRouter(options: AiRequestOptions): boolean {
  return options.preferences.provider === "openrouter";
}

async function effectiveKey(
  options: AiRequestOptions,
  provider: ResearcherId,
  userKey?: string,
): Promise<string> {
  if (wantsOpenRouter(options)) return openRouterKey(options);
  return nativeKey(provider, userKey);
}

function localDeps(options: AiRequestOptions): CoreDeps {
  return wantsOpenRouter(options) ? (isNativeAi() ? nativeDeps : webDeps) : nativeDeps;
}

/** Falha de configuração do OpenRouter antes de qualquer chamada de rede. */
function missingOpenRouter<T>(): AiResult<T> {
  const message = "Sem chave do OpenRouter. Cole a sua chave (sk-or-…) em Ajustes.";
  return {
    ok: false,
    error: message,
    failure: { kind: "missing-key", message, retryAfterSeconds: null, provider: "openrouter" },
  };
}

export async function generatePackageClient(
  input: GeneratePackageInput,
): Promise<AiResult<PackageBody>> {
  const options = aiOptions(input);
  if (!wantsOpenRouter(options) && !isNativeAi()) {
    return webResult(() => generatePackage({ data: withoutAi(input) }));
  }
  const userKey = await effectiveKey(options, input.provider, input.userKey);
  if (wantsOpenRouter(options) && !userKey) return missingOpenRouter<PackageBody>();
  return runGeneratePackage({ ...input, userKey, ai: options }, localDeps(options));
}

export async function generateBlockPackageClient(
  input: GenerateBlockInput,
): Promise<AiResult<AiBlockPackage>> {
  const options = aiOptions(input);
  if (!wantsOpenRouter(options) && !isNativeAi()) {
    return webResult(() => generateBlockPackage({ data: withoutAi(input) }));
  }
  const userKey = await effectiveKey(options, "grok", input.userKey);
  if (wantsOpenRouter(options) && !userKey) return missingOpenRouter();
  return runGenerateBlockPackage({ ...input, userKey, ai: options }, localDeps(options));
}

export async function researchAddClient(input: ResearchInput): Promise<AiResult<ResearchAddition>> {
  const options = aiOptions(input);
  if (!wantsOpenRouter(options) && !isNativeAi()) {
    return webResult(() => researchAdd({ data: withoutAi(input) }));
  }
  const userKey = await effectiveKey(options, "grok", input.userKey);
  if (wantsOpenRouter(options) && !userKey) return missingOpenRouter();
  return runResearchAdd({ ...input, userKey, ai: options }, localDeps(options));
}

export async function pingAiClient(input: PingInput): Promise<AiResult<{ text: string }>> {
  const options = aiOptions(input);
  if (!wantsOpenRouter(options) && !isNativeAi()) {
    return webResult(() => pingAi({ data: withoutAi(input) }));
  }
  const userKey = await effectiveKey(options, input.provider, input.userKey);
  if (wantsOpenRouter(options) && !userKey) return missingOpenRouter();
  return runPingAi({ ...input, userKey, ai: options }, localDeps(options));
}

export async function tutorTurnClient(
  input: TutorInput,
): Promise<AiResult<{ item?: QuizItem; text?: string }>> {
  const options = aiOptions(input);
  if (!wantsOpenRouter(options) && !isNativeAi()) {
    return webResult(() => tutorTurn({ data: withoutAi(input) }));
  }
  const userKey = await effectiveKey(options, "grok", input.userKey);
  if (wantsOpenRouter(options) && !userKey) return missingOpenRouter();
  return runTutorTurn({ ...input, userKey, ai: options }, localDeps(options));
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
  /** Imagens (data URL/base64) anexadas à última pergunta. */
  images?: string[];
  /** Provedor ativo, modelo e catálogo. Ausente = xAI, como sempre. */
  ai?: AiRequestOptions;
};

/**
 * Resposta completa (sem stream) do professor no provedor ativo. A UI aplica
 * o mesmo `present()` da web depois de receber o texto inteiro.
 */
export async function providerProfessorReply(
  input: ProfessorInput,
  transport: "capacitor" | "fetch" = isNativeAi() ? "capacitor" : "fetch",
): Promise<string> {
  const options = aiOptions(input);
  const key = await effectiveKey(options, "grok", input.userKey);
  if (!key) {
    const message =
      options.preferences.provider === "openrouter"
        ? "Sem chave do OpenRouter. Cole a sua chave (sk-or-…) em Ajustes."
        : "Sem chave da xAI. Cole a sua chave em Ajustes.";
    throw new AiRequestError(message, "missing-key", {
      provider: options.preferences.provider === "openrouter" ? "openrouter" : "xai",
    });
  }
  const history = normalizeProfessorHistory(input.messages);
  if (!history.length) throw new AiRequestError("Escreva a dúvida primeiro.", "bad-request");

  const messages = professorMessagesWithImages(
    [{ role: "system", content: buildProfessorSystemPrompt(input) }, ...history],
    input.images ?? [],
  );

  const xai = (request: {
    messages: ProviderMessage[];
    maxTokens: number;
    temperature?: number;
    json?: boolean;
    timeoutMs?: number;
  }) => {
    const call = {
      key,
      messages: request.messages,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      json: request.json,
      readTimeout: request.timeoutMs,
    };
    return transport === "capacitor" ? xaiChat(call) : webXaiChat(call);
  };

  return providerChat(
    {
      ...options,
      openRouterKey: options.preferences.provider === "openrouter" ? key : options.openRouterKey,
      transport: transport === "capacitor" ? capacitorTransport : fetchTransport,
    },
    {
      messages,
      maxTokens: 700,
      temperature: 0.3,
      json: false,
      timeoutMs: PROFESSOR_TIMEOUT,
    },
    xai,
  );
}

/** Compatibilidade com o caminho nativo antigo. */
export async function nativeProfessorReply(input: ProfessorInput): Promise<string> {
  return providerProfessorReply(input, "capacitor");
}
