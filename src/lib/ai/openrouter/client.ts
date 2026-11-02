/**
 * Cliente HTTP do OpenRouter — lógica pura com transporte injetável.
 *
 * As funções daqui não importam `@capacitor/core`: o transporte real
 * (`transport.ts`) decide entre `CapacitorHttp` no APK e `fetch` na web. Assim
 * os testes cobrem corpo, cabeçalhos, fallback e mapeamento de erro sem rede.
 *
 * Endpoints usados (documentação oficial do OpenRouter):
 * - `POST /api/v1/chat/completions` — formato OpenAI, com `models` de fallback;
 * - `GET  /api/v1/models` — catálogo com preço e modalidades.
 *
 * A autenticação é só a chave colada pela pessoa (`sk-or-…`): não há OAuth,
 * PKCE nem callback neste cliente.
 */

import { AiRequestError, emptyError, httpError, transportFailure } from "../errors.ts";

export const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

/** Atribuição exigida/recomendada pelo OpenRouter. */
export const OPENROUTER_APP_REFERER = "https://github.com/guilhermelramos/Reta";
export const OPENROUTER_APP_TITLE = "Reta";
/** Nome usado nas mensagens de erro ("chave do OpenRouter"). */
export const OPENROUTER_PROVIDER_LABEL = "OpenRouter";

/** Slug do roteador automático do OpenRouter. */
export const OPENROUTER_AUTO_MODEL = "openrouter/auto";

export const DEFAULT_TIMEOUT_MS = 20000;

export type HttpMethod = "GET" | "POST";

export type HttpRequest = {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  /** Objeto já serializável: o transporte faz o `JSON.stringify`. */
  body?: unknown;
  timeoutMs?: number;
};

export type HttpResponse = {
  status: number;
  /** Corpo já convertido: objeto quando é JSON, texto quando não é. */
  data: unknown;
  headers: Record<string, string>;
};

export type HttpTransport = (request: HttpRequest) => Promise<HttpResponse>;

/* ------------------------------- Modelos ------------------------------- */

export type ModelPricing = {
  /** USD por 1 milhão de tokens de entrada (`null` quando não informado). */
  promptPerMillion: number | null;
  /** USD por 1 milhão de tokens de saída (`null` quando não informado). */
  completionPerMillion: number | null;
};

export type OpenRouterModel = {
  id: string;
  name: string;
  /** `:free` no id ou preço de entrada e saída zerados. */
  free: boolean;
  /** `architecture.input_modalities` inclui `"image"`. */
  supportsImages: boolean;
  contextLength: number | null;
  pricing: ModelPricing;
  inputModalities: string[];
  outputModalities: string[];
};

function finitePrice(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : Number.NaN;
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function perMillion(value: unknown): number | null {
  const price = finitePrice(value);
  if (price == null) return null;
  // Evita ruído de ponto flutuante (0.000003 * 1e6 = 3.0000000000000004).
  return Math.round(price * 1_000_000 * 1_000_000) / 1_000_000;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

/** Regra do catálogo: grátis quando o id termina em `:free` ou o preço é zero. */
export function isFreeModel(
  id: string,
  promptPerMillion: number | null,
  completionPerMillion: number | null,
): boolean {
  if (id.trim().endsWith(":free")) return true;
  return promptPerMillion === 0 && completionPerMillion === 0;
}

/** Converte uma linha de `GET /api/v1/models`; devolve `null` se não tem id. */
export function normalizeModel(raw: unknown): OpenRouterModel | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) return null;
  const pricingRow =
    row.pricing && typeof row.pricing === "object" ? (row.pricing as Record<string, unknown>) : {};
  const promptPerMillion = perMillion(pricingRow.prompt);
  const completionPerMillion = perMillion(pricingRow.completion);
  const architecture =
    row.architecture && typeof row.architecture === "object"
      ? (row.architecture as Record<string, unknown>)
      : {};
  const inputModalities = stringList(architecture.input_modalities);
  const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : id;
  const context =
    typeof row.context_length === "number" && Number.isFinite(row.context_length)
      ? Math.max(0, Math.round(row.context_length))
      : null;
  return {
    id,
    name,
    free: isFreeModel(id, promptPerMillion, completionPerMillion),
    supportsImages: inputModalities.includes("image"),
    contextLength: context,
    pricing: { promptPerMillion, completionPerMillion },
    inputModalities,
    outputModalities: stringList(architecture.output_modalities),
  };
}

/* ------------------------------- Conteúdo ------------------------------- */

export type OpenRouterTextPart = { type: "text"; text: string };
export type OpenRouterImagePart = { type: "image_url"; image_url: { url: string } };
export type OpenRouterContentPart = OpenRouterTextPart | OpenRouterImagePart;

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  /** Texto simples ou partes (texto + imagem), no formato OpenAI. */
  content: string | OpenRouterContentPart[];
};

/** Mensagem com pelo menos uma imagem anexada. */
export function hasImagePart(messages: readonly OpenRouterMessage[]): boolean {
  return messages.some(
    (message) =>
      Array.isArray(message.content) &&
      message.content.some((part) => part.type === "image_url" && Boolean(part.image_url?.url)),
  );
}

/** Atalho para montar o anexo de imagem a partir de um data URL/base64. */
export function imagePart(url: string): OpenRouterImagePart {
  return { type: "image_url", image_url: { url } };
}

export function visionUnsupportedError(model: string): AiRequestError {
  return new AiRequestError(
    `O modelo ${model} não lê imagens. Escolha um modelo com visão em Ajustes ou envie só o texto.`,
    "vision",
    { provider: "openrouter" },
  );
}

/**
 * Bloqueia o envio quando o catálogo diz que o modelo principal não aceita
 * imagem. Sem catálogo (ou com modelo desconhecido) não dá para saber: o
 * pedido segue e o OpenRouter responde com o erro dele.
 */
export function assertVisionSupport(
  model: string,
  messages: readonly OpenRouterMessage[],
  catalog?: readonly OpenRouterModel[],
): void {
  if (!catalog?.length || !hasImagePart(messages)) return;
  const entry = catalog.find((item) => item.id === model);
  if (entry && !entry.supportsImages) throw visionUnsupportedError(model);
}

/* ------------------------------ Cabeçalhos ------------------------------ */

export function authHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key.trim()}`,
    "Content-Type": "application/json",
  };
}

/** Cabeçalhos do chat: chave + atribuição do app. */
export function chatHeaders(key: string): Record<string, string> {
  return {
    ...authHeaders(key),
    "HTTP-Referer": OPENROUTER_APP_REFERER,
    "X-Title": OPENROUTER_APP_TITLE,
  };
}

/* --------------------------------- Erros -------------------------------- */

function headerValue(headers: Record<string, string>, name: string): string | null {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === wanted) return value;
  }
  return null;
}

/**
 * Mensagem do erro no corpo `{ error: { code, message, metadata? } }`.
 *
 * O corpo é só uma pista para 400/404: os status conhecidos (chave, saldo,
 * limite) usam texto fixo em português para não vazar nada.
 */
export function openRouterErrorMessage(data: unknown): string {
  if (typeof data === "string") return data.trim().slice(0, 200);
  if (!data || typeof data !== "object") return "";
  const value = data as Record<string, unknown>;
  const error = value.error;
  if (typeof error === "string") return error.trim().slice(0, 200);
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message.trim().slice(0, 200);
  }
  const message = value.message;
  return typeof message === "string" ? message.trim().slice(0, 200) : "";
}

/**
 * Traduz status do OpenRouter para os `AiErrorKind` do app.
 *
 * 401 chave inválida · 402 sem créditos · 403 chave bloqueada/limite ·
 * 429 limite com `Retry-After` · 408 timeout · 5xx indisponível.
 */
export function openRouterHttpError(
  status: number,
  data: unknown = "",
  options: { retryAfter?: string | number | null; now?: number } = {},
): AiRequestError {
  if (status === 401) {
    return new AiRequestError(
      "Chave do OpenRouter inválida ou revogada. Cole uma nova em Ajustes.",
      "unauthorized",
      { status, provider: "openrouter" },
    );
  }
  if (status === 402) {
    return new AiRequestError(
      "Sem créditos no OpenRouter. Escolha um modelo grátis ou recarregue.",
      "no-credits",
      { status, provider: "openrouter" },
    );
  }
  if (status === 403) {
    return new AiRequestError(
      "Sua chave do OpenRouter foi bloqueada ou atingiu o limite de uso. Confira a chave em Ajustes.",
      "unauthorized",
      { status, provider: "openrouter" },
    );
  }
  return httpError(status, openRouterErrorMessage(data), {
    retryAfter: options.retryAfter ?? null,
    providerLabel: OPENROUTER_PROVIDER_LABEL,
    provider: "openrouter",
    ...(options.now != null ? { now: options.now } : {}),
  });
}

/* ------------------------------ Chat ----------------------------------- */

export type ChatCompletionRequest = {
  key: string;
  model: string;
  /** Modelos tentados em ordem pelo próprio OpenRouter (`models`). */
  fallbacks?: readonly string[];
  messages: OpenRouterMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Pede `response_format: { type: "json_object" }` ao provedor. */
  json?: boolean;
  /** Catálogo para checar visão antes de enviar; opcional. */
  catalog?: readonly OpenRouterModel[];
  timeoutMs?: number;
};

export type ChatCompletionResult = {
  text: string;
  /** Modelo que respondeu (o OpenRouter troca quando usa fallback). */
  model: string;
  usage: Record<string, unknown> | null;
};

/**
 * Corpo de `POST /chat/completions`.
 *
 * Envia **sempre** `models: [principal, …fallbacks]` e omite `model`: é o
 * campo de fallback nativo documentado pelo OpenRouter e vale também para um
 * único modelo (ex.: `["openrouter/auto"]`). O `model` não é duplicado.
 */
export function buildChatBody(request: ChatCompletionRequest): Record<string, unknown> {
  const model = request.model.trim();
  const fallbacks = (request.fallbacks ?? []).map((item) => item.trim()).filter(Boolean);
  const models = [model, ...fallbacks.filter((item) => item !== model)];
  const body: Record<string, unknown> = {
    messages: request.messages,
    // CapacitorHttp não entrega SSE: a resposta chega completa nos dois caminhos.
    stream: false,
    models,
  };
  if (request.maxTokens != null && Number.isFinite(request.maxTokens)) {
    body.max_tokens = Math.max(1, Math.round(request.maxTokens));
  }
  if (request.temperature != null && Number.isFinite(request.temperature)) {
    body.temperature = request.temperature;
  }
  if (request.json) body.response_format = { type: "json_object" };
  return body;
}

/** Texto da resposta, aceitando `content` string ou partes do formato OpenAI. */
export function completionText(data: unknown): string {
  const body = data as { choices?: { message?: { content?: unknown } }[] } | null | undefined;
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
          ? (part as { text: string }).text
          : "",
      )
      .join("");
  }
  return "";
}

export async function chatCompletion(
  request: ChatCompletionRequest,
  transport: HttpTransport,
): Promise<ChatCompletionResult> {
  const model = request.model.trim();
  if (!model)
    throw new AiRequestError("Escolha um modelo do OpenRouter em Ajustes.", "bad-request", {
      provider: "openrouter",
    });
  const key = request.key.trim();
  if (!key) {
    throw new AiRequestError(
      "Sem chave do OpenRouter. Cole a sua chave (sk-or-…) em Ajustes.",
      "missing-key",
      { provider: "openrouter" },
    );
  }
  if (!request.messages.length) {
    throw new AiRequestError("Nada para enviar ao OpenRouter.", "bad-request", {
      provider: "openrouter",
    });
  }
  // Antes da rede: imagem + modelo sem visão é um erro de configuração.
  assertVisionSupport(model, request.messages, request.catalog);

  let response: HttpResponse;
  try {
    response = await transport({
      method: "POST",
      url: `${OPENROUTER_API_BASE}/chat/completions`,
      headers: chatHeaders(key),
      body: buildChatBody(request),
      timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  } catch (error) {
    throw transportFailure(error);
  }

  if (response.status < 200 || response.status >= 300) {
    throw openRouterHttpError(response.status, response.data, {
      retryAfter: headerValue(response.headers, "retry-after"),
    });
  }

  const text = completionText(response.data);
  if (!text.trim()) throw emptyError("O OpenRouter devolveu uma resposta vazia. Tente de novo.");
  const body = response.data as { model?: unknown; usage?: unknown } | null;
  return {
    text,
    model: typeof body?.model === "string" && body.model ? body.model : model,
    usage:
      body?.usage && typeof body.usage === "object"
        ? (body.usage as Record<string, unknown>)
        : null,
  };
}

/* ------------------------------ Catálogo -------------------------------- */

/** `GET /api/v1/models` normalizado (preço por 1M, grátis, visão). */
export async function listModels(
  transport: HttpTransport,
  options: { timeoutMs?: number; key?: string } = {},
): Promise<OpenRouterModel[]> {
  // O catálogo é público, mas "Testar conexão" manda a chave colada para o
  // OpenRouter confirmar o login (401/403 aparecem na hora).
  const key = (options.key ?? "").trim();
  let response: HttpResponse;
  try {
    response = await transport({
      method: "GET",
      url: `${OPENROUTER_API_BASE}/models`,
      headers: {
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        "X-Title": OPENROUTER_APP_TITLE,
      },
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  } catch (error) {
    throw transportFailure(error);
  }

  if (response.status < 200 || response.status >= 300) {
    throw openRouterHttpError(response.status, response.data, {
      retryAfter: headerValue(response.headers, "retry-after"),
    });
  }

  const rows = (response.data as { data?: unknown } | null)?.data;
  if (!Array.isArray(rows)) {
    throw new AiRequestError("A lista de modelos do OpenRouter veio vazia.", "empty", {
      provider: "openrouter",
    });
  }
  const models: OpenRouterModel[] = [];
  for (const row of rows) {
    const model = normalizeModel(row);
    if (model) models.push(model);
  }
  if (!models.length) {
    throw new AiRequestError("A lista de modelos do OpenRouter veio vazia.", "empty", {
      provider: "openrouter",
    });
  }
  return models;
}
