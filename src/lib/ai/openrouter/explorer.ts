/**
 * Explorador de modelos do OpenRouter — filtros, busca e ordenação puros.
 *
 * A lista vem de `GET /api/v1/models` (normalizada em `client.ts`). Aqui só
 * decidimos o que mostrar na folha "Explorar modelos", sem rede e sem React:
 * chips "Grátis" e "Lê imagens", busca por nome/id, ordenação por preço e a
 * validação do ID digitado à mão.
 */

import { OPENROUTER_AUTO_MODEL, type OpenRouterModel } from "./client.ts";
import { resolvePreset, type StudyPresetId } from "./presets.ts";

export type ExplorerSort = "relevance" | "price-asc" | "price-desc";

export type ExplorerFilters = {
  query: string;
  freeOnly: boolean;
  visionOnly: boolean;
  sort: ExplorerSort;
};

export const DEFAULT_EXPLORER_FILTERS: ExplorerFilters = {
  query: "",
  freeOnly: false,
  visionOnly: false,
  sort: "relevance",
};

export const EXPLORER_SORT_LABELS: Record<ExplorerSort, string> = {
  relevance: "Relevância",
  "price-asc": "Menor preço",
  "price-desc": "Maior preço",
};

/** Minúsculas, sem acentos e com espaços normalizados. */
export function normalizeSearchQuery(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesQuery(model: OpenRouterModel, query: string): boolean {
  if (!query) return true;
  return (
    normalizeSearchQuery(model.name).includes(query) ||
    normalizeSearchQuery(model.id).includes(query)
  );
}

/** Preço de referência: entrada + saída por 1M. Desconhecido vai para o fim. */
function priceOf(model: OpenRouterModel): number {
  const prompt = model.pricing.promptPerMillion;
  const completion = model.pricing.completionPerMillion;
  if (prompt == null && completion == null) return Number.POSITIVE_INFINITY;
  return (prompt ?? 0) + (completion ?? 0);
}

/**
 * Aplica busca + chips. A busca aceita nome ou id e ignora acentos/maiúsculas.
 * Os chips são cumulativos: "Grátis" e "Lê imagens" ao mesmo tempo devolve só
 * os modelos que atendem aos dois.
 */
export function filterModels(
  models: readonly OpenRouterModel[],
  filters: Pick<ExplorerFilters, "query" | "freeOnly" | "visionOnly">,
): OpenRouterModel[] {
  const query = normalizeSearchQuery(filters.query);
  return models.filter((model) => {
    if (filters.freeOnly && !model.free) return false;
    if (filters.visionOnly && !model.supportsImages) return false;
    return matchesQuery(model, query);
  });
}

/** Ordena uma cópia; "relevance" preserva a ordem do catálogo. */
export function sortModels(
  models: readonly OpenRouterModel[],
  sort: ExplorerSort,
): OpenRouterModel[] {
  const copy = models.slice();
  if (sort === "relevance") return copy;
  const direction = sort === "price-asc" ? 1 : -1;
  copy.sort((a, b) => {
    const priceA = priceOf(a);
    const priceB = priceOf(b);
    // Desconhecido (Infinity) fica no fim nas duas direções.
    if (priceA === priceB) return a.id.localeCompare(b.id);
    if (!Number.isFinite(priceA)) return 1;
    if (!Number.isFinite(priceB)) return -1;
    return (priceA - priceB) * direction;
  });
  return copy;
}

/** Filtra e ordena em uma passada, sem alterar a lista original. */
export function exploreModels(
  models: readonly OpenRouterModel[],
  filters: ExplorerFilters,
): OpenRouterModel[] {
  return sortModels(filterModels(models, filters), filters.sort);
}

/** Preço curto para a lista: "Grátis", "$0,30 / 1M" ou "Preço não informado". */
export function priceLabel(model: OpenRouterModel): string {
  if (model.free) return "Grátis";
  const prompt = model.pricing.promptPerMillion;
  const completion = model.pricing.completionPerMillion;
  if (prompt == null && completion == null) return "Preço não informado";
  const format = (value: number | null) => (value == null ? "?" : formatUsd(value));
  if (prompt != null && completion != null && prompt === completion) {
    return `${format(prompt)} / 1M`;
  }
  return `Entrada ${format(prompt)} · Saída ${format(completion)}`;
}

function formatUsd(value: number): string {
  if (value === 0) return "$0";
  const fixed = value >= 10 ? value.toFixed(0) : value >= 1 ? value.toFixed(2) : value.toFixed(3);
  return `$${fixed.replace(/0+$/, "").replace(/\.$/, "")}`;
}

/** Rótulo do contexto em milhares (ex.: 128 mil). */
export function contextLabel(model: OpenRouterModel): string {
  const value = model.contextLength;
  if (value == null || value <= 0) return "";
  if (value >= 1_000_000) {
    const millions = Math.round((value / 1_000_000) * 10) / 10;
    return `${millions}M tokens`;
  }
  if (value >= 1000) return `${Math.round(value / 1000)} mil tokens`;
  return `${value} tokens`;
}

/**
 * Valida o ID digitado à mão. O formato documentado é `autor/modelo` (com
 * sufixo opcional `:free`); `openrouter/auto` também é aceito. Não consulta a
 * rede: se o modelo não existir, o OpenRouter responde com o erro dele.
 */
export function validateManualModelId(value: unknown): { ok: true; value: string } | { ok: false } {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean || /\s/.test(clean)) return { ok: false };
  if (clean === OPENROUTER_AUTO_MODEL) return { ok: true, value: clean };
  if (clean.startsWith("/") || clean.endsWith("/") || clean.includes("//")) return { ok: false };
  if (!clean.includes("/")) return { ok: false };
  return { ok: true, value: clean };
}

/**
 * Preset correspondente ao modelo salvo, para marcar o cartão certo. O
 * `openrouter/auto` é sempre "Custo-benefício"; os outros dependem do catálogo
 * para saber qual preset os resolveria.
 */
export function presetForModel(
  model: string,
  catalog: readonly OpenRouterModel[],
): StudyPresetId | null {
  const clean = model.trim();
  if (!clean) return null;
  if (clean === OPENROUTER_AUTO_MODEL) return "value";
  if (!catalog.length) return null;
  for (const preset of ["fast-free", "vision"] as const) {
    const choice = resolvePreset(preset, catalog);
    if (choice?.model === clean) return preset;
  }
  return null;
}
