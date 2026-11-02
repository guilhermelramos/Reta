/**
 * Preferência e roteamento de provedor de IA.
 *
 * A xAI continua sendo o padrão e o caminho atual dela não muda: quando o
 * provedor ativo é `xai`, a camada delega para o transporte que já existia
 * (server function na web, CapacitorHttp no APK). Quando é `openrouter`, o
 * mesmo prompt/parse de `core.ts` usa o cliente do OpenRouter.
 *
 * Este módulo é puro: rede, Capacitor, IndexedDB e React ficam de fora. O
 * transporte do OpenRouter entra por parâmetro (`HttpTransport`), então os
 * testes cobrem a escolha do provedor, os modelos de fallback e o gate de
 * imagem sem tocar na internet.
 *
 * Segurança: a chave nunca é embutida nem gravada aqui. Ela chega em memória
 * (do cofre do aparelho/IndexedDB) e só é repassada ao cabeçalho Authorization
 * pelo cliente HTTP.
 */

import { AiRequestError } from "./errors.ts";
import {
  OPENROUTER_AUTO_MODEL,
  chatCompletion,
  imagePart,
  type HttpTransport,
  type OpenRouterContentPart,
  type OpenRouterMessage,
  type OpenRouterModel,
} from "./openrouter/client.ts";
import { resolvePreset, type PresetChoice, type StudyPresetId } from "./openrouter/presets.ts";

export type AiProvider = "xai" | "openrouter";

export const AI_PROVIDERS: readonly AiProvider[] = ["xai", "openrouter"];

/** Provedor padrão do app; a xAI segue com o fluxo de sempre. */
export const DEFAULT_AI_PROVIDER: AiProvider = "xai";

export type AiPreferences = {
  provider: AiProvider;
  /** Modelo escolhido à mão (`""` = usar o preset resolvido ou o auto). */
  openRouterModel: string;
  /** Modelos tentados em ordem depois do principal. */
  openRouterFallbacks: string[];
};

export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  provider: DEFAULT_AI_PROVIDER,
  openRouterModel: "",
  openRouterFallbacks: [],
};

export function isAiProvider(value: unknown): value is AiProvider {
  return value === "xai" || value === "openrouter";
}

/** Nome do provedor para a interface (a xAI mantém a grafia usada no app). */
export function aiProviderLabel(provider: AiProvider): string {
  return provider === "openrouter" ? "OpenRouter" : "xAI";
}

/** Aceita qualquer valor e devolve um id de modelo limpo (`""` quando inválido). */
export function normalizeModelId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Lista de fallbacks: só texto, sem espaços nas pontas, sem vazios, sem
 * repetições e sem o modelo principal (o OpenRouter já o tenta primeiro).
 */
export function normalizeFallbacks(value: unknown, primary = ""): string[] {
  if (!Array.isArray(value)) return [];
  const main = normalizeModelId(primary);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const model = normalizeModelId(item);
    if (!model || model === main || seen.has(model)) continue;
    seen.add(model);
    out.push(model);
  }
  return out;
}

type AiPreferenceSource = {
  aiProvider?: unknown;
  openRouterModel?: unknown;
  openRouterFallbacks?: unknown;
};

/**
 * Normaliza o que veio do IndexedDB/backup. Provedor desconhecido, campo
 * ausente ou valor estranho cai em xAI — o padrão nunca muda sozinho.
 */
export function normalizeAiPreferences(raw: unknown): AiPreferences {
  const source: AiPreferenceSource =
    raw && typeof raw === "object" ? (raw as AiPreferenceSource) : {};
  const provider = isAiProvider(source.aiProvider) ? source.aiProvider : DEFAULT_AI_PROVIDER;
  const openRouterModel = normalizeModelId(source.openRouterModel);
  return {
    provider,
    openRouterModel,
    openRouterFallbacks: normalizeFallbacks(source.openRouterFallbacks, openRouterModel),
  };
}

/** Extrai só as preferências de um objeto de ajustes completo. */
export function aiPreferences(settings: {
  aiProvider?: unknown;
  openRouterModel?: unknown;
  openRouterFallbacks?: unknown;
}): AiPreferences {
  return normalizeAiPreferences(settings);
}

/**
 * Modelos que um pedido específico deve usar: o principal escolhido e, quando
 * houver, os fallbacks. Devolve `[]` quando não há modelo (a UI resolve um
 * preset antes de chamar a IA).
 */
export function selectedModels(preferences: AiPreferences): string[] {
  const primary = normalizeModelId(preferences.openRouterModel);
  if (!primary) return [];
  return [primary, ...normalizeFallbacks(preferences.openRouterFallbacks, primary)];
}

/**
 * Lista enviada ao OpenRouter em **todo** pedido.
 *
 * O principal vem primeiro; em seguida os fallbacks escolhidos. O
 * `openrouter/auto` é sempre o último recurso, mesmo quando a pessoa não
 * configurou nada — assim um modelo removido do catálogo não derruba a aula.
 */
export function routedModels(preferences: AiPreferences): string[] {
  const primary = normalizeModelId(preferences.openRouterModel) || OPENROUTER_AUTO_MODEL;
  const models = [primary, ...normalizeFallbacks(preferences.openRouterFallbacks, primary)];
  if (!models.includes(OPENROUTER_AUTO_MODEL)) models.push(OPENROUTER_AUTO_MODEL);
  return models;
}

/** O provedor ativo só é OpenRouter quando há um modelo escolhido. */
export function isOpenRouterReady(preferences: AiPreferences): boolean {
  return (
    preferences.provider === "openrouter" && Boolean(normalizeModelId(preferences.openRouterModel))
  );
}

/* ------------------------------------------------------------------ *
 * Roteamento de uma chamada
 * ------------------------------------------------------------------ */

/** Mensagem no formato OpenAI, aceito tanto pelo OpenRouter quanto pela xAI. */
export type ProviderMessage = OpenRouterMessage;

export type ProviderChatRequest = {
  messages: ProviderMessage[];
  maxTokens: number;
  temperature?: number;
  /** Quase todos os fluxos pedem JSON; o professor usa texto livre. */
  json?: boolean;
  timeoutMs?: number;
  /** xAI: usa o access token do login experimental (sem chave de API). */
  xaiOAuth?: boolean;
};

/** Transporte da xAI já existente (server function ou CapacitorHttp). */
export type ProviderXaiChat = (request: ProviderChatRequest) => Promise<string>;

/**
 * Opções de uma chamada: preferências + a chave do OpenRouter (em memória) e
 * o catálogo em cache, quando a tela já o tiver carregado.
 */
export type AiRequestOptions = {
  preferences: AiPreferences;
  /** Chave `sk-or-…`; nunca é registrada em log nem persistida aqui. */
  openRouterKey?: string;
  catalog?: readonly OpenRouterModel[];
  /** Injetado pelo adaptador: CapacitorHttp no APK, fetch na web. */
  transport?: HttpTransport;
};

export const DEFAULT_AI_REQUEST_OPTIONS: AiRequestOptions = {
  preferences: DEFAULT_AI_PREFERENCES,
};

/** Monta as opções a partir dos ajustes e da chave em memória (cofre). */
export function aiOptionsFor(
  settings: {
    aiProvider?: unknown;
    openRouterModel?: unknown;
    openRouterFallbacks?: unknown;
  },
  openRouterKey?: string,
  catalog?: readonly OpenRouterModel[],
): AiRequestOptions {
  return {
    preferences: aiPreferences(settings),
    ...(typeof openRouterKey === "string" && openRouterKey.trim()
      ? { openRouterKey: openRouterKey.trim() }
      : {}),
    ...(catalog?.length ? { catalog } : {}),
  };
}

export function normalizeAiRequestOptions(raw: unknown): AiRequestOptions {
  const source = raw && typeof raw === "object" ? (raw as Partial<AiRequestOptions>) : {};
  return {
    preferences: normalizeAiPreferences(source.preferences),
    ...(typeof source.openRouterKey === "string" && source.openRouterKey.trim()
      ? { openRouterKey: source.openRouterKey.trim() }
      : {}),
    ...(Array.isArray(source.catalog) && source.catalog.length
      ? { catalog: source.catalog }
      : {}),
  };
}

/** Converte texto simples em uma mensagem; com imagens vira partes OpenAI. */
export function promptMessage(prompt: string, images: readonly string[] = []): ProviderMessage {
  const urls = images.map((url) => url.trim()).filter(Boolean);
  if (!urls.length) return { role: "user", content: prompt };
  const parts: OpenRouterContentPart[] = [{ type: "text", text: prompt }];
  for (const url of urls) parts.push(imagePart(url));
  return { role: "user", content: parts };
}

/**
 * Anexa as imagens à última fala da pessoa no histórico do professor. O texto
 * existente é preservado; as partes de imagem entram logo depois dele.
 */
export function professorMessagesWithImages(
  messages: readonly ProviderMessage[],
  images: readonly string[],
): ProviderMessage[] {
  const urls = images.map((url) => url.trim()).filter(Boolean);
  if (!urls.length) return messages.map((message) => ({ ...message }));
  let lastUser = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      lastUser = index;
      break;
    }
  }
  if (lastUser < 0) return messages.map((message) => ({ ...message }));

  return messages.map((message, index) => {
    if (index !== lastUser) return { ...message };
    const text =
      typeof message.content === "string"
        ? message.content
        : message.content
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("")
            .trim();
    return {
      role: "user",
      content: [
        { type: "text", text },
        ...urls.map((url) => imagePart(url)),
      ],
    };
  });
}

function missingOpenRouterKeyError(): AiRequestError {
  return new AiRequestError(
    "Sem chave do OpenRouter. Cole a sua chave (sk-or-…) em Ajustes.",
    "missing-key",
    { provider: "openrouter" },
  );
}

/**
 * Executa um chat no provedor ativo.
 *
 * - xAI: delega ao caminho atual, sem alterar prompt, timeout ou stream.
 * - OpenRouter: usa `models` com principal + fallbacks (+ `openrouter/auto`)
 *   e o transporte recebido (CapacitorHttp no APK, fetch na web).
 */
export async function providerChat(
  options: AiRequestOptions,
  request: ProviderChatRequest,
  xai: ProviderXaiChat,
): Promise<string> {
  const preferences = options.preferences ?? DEFAULT_AI_PREFERENCES;
  if (preferences.provider !== "openrouter") return xai(request);

  const key = (options.openRouterKey ?? "").trim();
  if (!key) throw missingOpenRouterKeyError();

  const models = routedModels(preferences);
  const [model, ...fallbacks] = models;
  if (!model) throw missingOpenRouterKeyError();

  const result = await chatCompletion(
    {
      key,
      model,
      fallbacks,
      messages: request.messages,
      maxTokens: request.maxTokens,
      ...(request.temperature != null ? { temperature: request.temperature } : {}),
      ...(request.json === true ? { json: true } : {}),
      ...(request.timeoutMs != null ? { timeoutMs: request.timeoutMs } : {}),
      ...(options.catalog?.length ? { catalog: options.catalog } : {}),
    },
    transportFor(options),
  );
  return result.text;
}

function transportFor(options: AiRequestOptions): HttpTransport {
  const transport = options.transport;
  if (!transport) {
    throw new AiRequestError(
      "O transporte do OpenRouter não foi configurado neste ambiente.",
      "unknown",
      { provider: "openrouter" },
    );
  }
  return transport;
}

/* ------------------------------------------------------------------ *
 * Visão (anexo de imagem)
 * ------------------------------------------------------------------ */

export const VISION_BLOCKED_MESSAGE =
  "Este modelo não lê imagens. Use um modelo com visão para anexar a foto.";
export const VISION_ACTION_LABEL = "Usar modelo que lê fotos";
export const FREE_MODEL_ACTION_LABEL = "Usar modelo grátis";

export type VisionGate = {
  allowed: boolean;
  /** Explicação curta quando o anexo está bloqueado. */
  message?: string;
  actionLabel?: string;
  /** Preset de visão resolvido no catálogo (1 toque na UI). */
  choice?: PresetChoice | null;
};

/**
 * Decide se a foto pode ser anexada antes de sair da rede.
 *
 * Só bloqueia quando o catálogo em cache conhece o modelo principal e diz que
 * ele não aceita `image`. Sem catálogo (ou modelo recém-lançado) não há como
 * saber: o pedido segue e o OpenRouter responde com o erro dele.
 *
 * A xAI continua aceitando imagem como antes.
 */
export function visionAttachmentGate(
  options: AiRequestOptions | AiPreferences,
): VisionGate {
  const preferences =
    "preferences" in options ? options.preferences : (options as AiPreferences);
  if (preferences.provider !== "openrouter") return { allowed: true };
  const catalog = "catalog" in options ? options.catalog : undefined;
  if (!catalog?.length) return { allowed: true };

  const primary = routedModels(preferences)[0] ?? "";
  const entry = catalog.find((model) => model.id === primary);
  if (!entry || entry.supportsImages) return { allowed: true };

  return {
    allowed: false,
    message: VISION_BLOCKED_MESSAGE,
    actionLabel: VISION_ACTION_LABEL,
    choice: resolvePreset("vision", catalog),
  };
}

/** Aplica o preset de visão às preferências (ação de 1 toque). */
export function withVisionPreset(
  preferences: AiPreferences,
  catalog: readonly OpenRouterModel[],
): { preferences: AiPreferences; choice: PresetChoice | null } {
  const choice = resolvePreset("vision", catalog);
  if (!choice) return { preferences, choice: null };
  return {
    preferences: {
      ...preferences,
      provider: "openrouter",
      openRouterModel: choice.model,
      openRouterFallbacks: choice.fallbacks,
    },
    choice,
  };
}

export function visionPresetChoice(
  catalog: readonly OpenRouterModel[],
): PresetChoice | null {
  return resolvePreset("vision", catalog);
}

/** Preset grátis para a ação do erro 402 ("Usar modelo grátis"). */
export function freePresetChoice(
  catalog: readonly OpenRouterModel[],
): PresetChoice | null {
  return resolvePreset("fast-free", catalog);
}

export function withPreset(
  preferences: AiPreferences,
  preset: StudyPresetId,
  catalog: readonly OpenRouterModel[],
): { preferences: AiPreferences; choice: PresetChoice | null } {
  const choice = resolvePreset(preset, catalog);
  if (!choice) return { preferences, choice: null };
  return {
    preferences: {
      ...preferences,
      provider: "openrouter",
      openRouterModel: choice.model,
      openRouterFallbacks: choice.fallbacks,
    },
    choice,
  };
}
