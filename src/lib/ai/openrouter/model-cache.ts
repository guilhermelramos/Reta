/**
 * Cache do catálogo de modelos do OpenRouter (24 h).
 *
 * A lista muda pouco e é grande (~1 MB no JSON bruto); baixar a cada abertura
 * gastaria dados à toa. Guardamos `{ fetchedAt, models }` já normalizado no
 * `localStorage` — não é segredo, então não vai para o cofre de chaves.
 *
 * A lógica de validade é pura e recebe o relógio por parâmetro; só as duas
 * funções `loadCachedModels`/`saveModels` tocam o `localStorage`.
 */

import type { OpenRouterModel } from "./client.ts";
import { normalizeModel } from "./client.ts";

export const MODEL_CACHE_KEY = "reta.openrouter.models.v1";

export const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type ModelCacheEntry = {
  /** `Date.now()` de quando a lista foi baixada. */
  fetchedAt: number;
  models: OpenRouterModel[];
};

/** Contrato mínimo de armazenamento (testável com um objeto em memória). */
export type ModelCacheStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function buildModelCache(models: readonly OpenRouterModel[], now: number): ModelCacheEntry {
  return {
    fetchedAt: Math.max(0, Math.round(Number.isFinite(now) ? now : 0)),
    models: models.slice(),
  };
}

/** Válido por 24 h; relógio adiantado (idade negativa) força baixar de novo. */
export function isModelCacheFresh(
  entry: ModelCacheEntry | null | undefined,
  now: number,
  ttlMs: number = MODEL_CACHE_TTL_MS,
): boolean {
  if (!entry || !Number.isFinite(entry.fetchedAt) || !Number.isFinite(now)) return false;
  const age = now - entry.fetchedAt;
  return age >= 0 && age < Math.max(0, ttlMs);
}

/** Aceita o JSON já parseado ou o texto salvo; ignora lixo sem lançar. */
export function parseModelCache(raw: unknown): ModelCacheEntry | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return null;
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const row = value as { fetchedAt?: unknown; models?: unknown };
  if (typeof row.fetchedAt !== "number" || !Number.isFinite(row.fetchedAt)) return null;
  if (!Array.isArray(row.models)) return null;
  const models: OpenRouterModel[] = [];
  for (const item of row.models) {
    const model = normalizeModel(item);
    if (model) models.push(model);
  }
  if (!models.length) return null;
  return { fetchedAt: row.fetchedAt, models };
}

export function serializeModelCache(entry: ModelCacheEntry): string {
  return JSON.stringify(entry);
}

/** Modelos válidos do cache, ou `null` quando ausente/vencido/corrompido. */
export function readModelCache(
  storage: ModelCacheStorage,
  now: number,
  ttlMs: number = MODEL_CACHE_TTL_MS,
): OpenRouterModel[] | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(MODEL_CACHE_KEY);
  } catch {
    return null;
  }
  const entry = parseModelCache(raw);
  if (!isModelCacheFresh(entry, now, ttlMs)) return null;
  return entry?.models ?? null;
}

/** Grava a lista normalizada e devolve a entrada criada. */
export function writeModelCache(
  storage: ModelCacheStorage,
  models: readonly OpenRouterModel[],
  now: number,
): ModelCacheEntry {
  const entry = buildModelCache(models, now);
  try {
    storage.setItem(MODEL_CACHE_KEY, serializeModelCache(entry));
  } catch {
    // Cota cheia/modo privado: seguir sem cache é melhor que falhar.
  }
  return entry;
}

export function clearModelCache(storage: ModelCacheStorage): void {
  try {
    storage.removeItem(MODEL_CACHE_KEY);
  } catch {
    // Sem cache gravável não há o que limpar.
  }
}

function browserStorage(): ModelCacheStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    // Safari/modo privado expõe o objeto mas lança ao gravar; o teste abaixo
    // garante que a chamada vai funcionar antes de devolver o armazenamento.
    const probe = `${MODEL_CACHE_KEY}.probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** Leitura no ambiente real (WebView/navegador). `null` = precisa baixar. */
export function loadCachedModels(now: number = Date.now()): OpenRouterModel[] | null {
  const storage = browserStorage();
  return storage ? readModelCache(storage, now) : null;
}

/** Gravação no ambiente real; silenciosa quando não há `localStorage`. */
export function saveModels(models: readonly OpenRouterModel[], now: number = Date.now()): void {
  const storage = browserStorage();
  if (storage) writeModelCache(storage, models, now);
}
