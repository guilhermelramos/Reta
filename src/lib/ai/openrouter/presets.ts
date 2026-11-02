/**
 * Presets de estudo do OpenRouter.
 *
 * São atalhos para quem não quer escolher entre centenas de modelos: cada
 * preset resolve um modelo principal + fallbacks a partir do catálogo
 * (`GET /api/v1/models`). Tudo aqui é puro: recebe a lista já normalizada e
 * devolve a escolha, sem rede.
 */

import type { OpenRouterModel } from "./client.ts";
import { OPENROUTER_AUTO_MODEL } from "./client.ts";

export type StudyPresetId = "fast-free" | "value" | "vision";

export type StudyPreset = {
  id: StudyPresetId;
  label: string;
  description: string;
};

export const STUDY_PRESETS: readonly StudyPreset[] = [
  {
    id: "fast-free",
    label: "Rápido e grátis",
    description:
      "Usa o primeiro modelo grátis (:free) do catálogo. Se ele falhar, o OpenRouter escolhe outro automaticamente.",
  },
  {
    id: "value",
    label: "Custo-benefício",
    description:
      "Deixa o OpenRouter escolher o modelo mais adequado para cada pedido (openrouter/auto).",
  },
  {
    id: "vision",
    label: "Lê fotos",
    description:
      "Escolhe um modelo que aceita imagem, para fotografar a questão ou a página do livro.",
  },
];

/** Preset com o qual o app abre quando há OpenRouter configurado. */
export const DEFAULT_STUDY_PRESET: StudyPresetId = "fast-free";

const PRESET_IDS: readonly StudyPresetId[] = STUDY_PRESETS.map((preset) => preset.id);

export function isStudyPresetId(value: unknown): value is StudyPresetId {
  return typeof value === "string" && PRESET_IDS.includes(value as StudyPresetId);
}

export function studyPreset(id: StudyPresetId): StudyPreset {
  return STUDY_PRESETS.find((preset) => preset.id === id) ?? STUDY_PRESETS[0]!;
}

export type PresetChoice = {
  preset: StudyPresetId;
  model: string;
  fallbacks: string[];
};

/** Modelos que aceitam imagem, do mais capaz para o menos capaz. */
export function visionModels(models: readonly OpenRouterModel[]): OpenRouterModel[] {
  return models
    .filter((model) => model.supportsImages)
    .slice()
    .sort((a, b) => {
      const context = (b.contextLength ?? 0) - (a.contextLength ?? 0);
      if (context !== 0) return context;
      // Mais capaz tende a custar mais; empate de contexto desempata por preço.
      const price = (b.pricing.promptPerMillion ?? 0) - (a.pricing.promptPerMillion ?? 0);
      if (price !== 0) return price;
      return a.id.localeCompare(b.id);
    });
}

/** Primeiro modelo gratuito: prioriza o sufixo `:free` documentado. */
export function firstFreeModel(models: readonly OpenRouterModel[]): OpenRouterModel | null {
  return (
    models.find((model) => model.free && model.id.endsWith(":free")) ??
    models.find((model) => model.free) ??
    null
  );
}

/**
 * Resolve o preset. Devolve `null` quando o catálogo não permite (ex.: nenhum
 * modelo com visão), para a UI pedir para atualizar a lista ou escolher à mão.
 */
export function resolvePreset(
  id: StudyPresetId,
  models: readonly OpenRouterModel[],
): PresetChoice | null {
  if (id === "value") {
    return { preset: id, model: OPENROUTER_AUTO_MODEL, fallbacks: [] };
  }

  if (id === "fast-free") {
    const free = firstFreeModel(models);
    if (!free) return null;
    const fallbacks = [OPENROUTER_AUTO_MODEL].filter((model) => model !== free.id);
    return { preset: id, model: free.id, fallbacks };
  }

  const vision = visionModels(models);
  const best = vision[0];
  if (!best) return null;
  return {
    preset: id,
    model: best.id,
    fallbacks: vision
      .slice(1, 3)
      .map((model) => model.id)
      .filter((model) => model !== best.id),
  };
}
