/**
 * Preferência de provedor de IA.
 *
 * A xAI continua sendo o padrão e nada aqui toca em chaves: o provedor ativo,
 * o modelo do OpenRouter e os fallbacks são preferências (não segredo) e vivem
 * em `settings` no IndexedDB, como o restante dos ajustes.
 *
 * Lógica pura, sem rede/React/IndexedDB, para os testes em Node cobrirem a
 * normalização de valores antigos ou adulterados.
 */

export type AiProvider = "xai" | "openrouter";

export const AI_PROVIDERS: readonly AiProvider[] = ["xai", "openrouter"];

/** Provedor padrão do app; a xAI segue com o fluxo de sempre. */
export const DEFAULT_AI_PROVIDER: AiProvider = "xai";

export type AiPreferences = {
  provider: AiProvider;
  /** Modelo escolhido à mão (`""` = usar o preset resolvido). */
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

/** O provedor ativo só é OpenRouter quando há um modelo escolhido. */
export function isOpenRouterReady(preferences: AiPreferences): boolean {
  return (
    preferences.provider === "openrouter" && Boolean(normalizeModelId(preferences.openRouterModel))
  );
}
