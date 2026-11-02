/**
 * Rascunho do formulário Novo/Editar dia.
 *
 * Fica fora do React para a conversão rascunho ↔ dia e a validação dos campos
 * ("45", "1h30", "01:30") poderem ser testadas em Node. A tela só guarda os
 * textos enquanto a pessoa digita.
 */

import { parseDuration } from "./time.ts";
import type { BlockKind, PlanBlock, PlanDay } from "./types.ts";
import { KIND_LABEL } from "./types.ts";

export const BLOCK_KINDS: BlockKind[] = ["A", "B", "R", "L"];

export type DraftBlock = {
  key: string;
  kind: BlockKind;
  content: string;
  minutes: string;
};

/** Dia em edição (novo ou existente), com os blocos ainda como texto. */
export type DayDraft = {
  mode: "edit" | "new";
  date: string;
  phase: string;
  blocks: DraftBlock[];
};

let draftSeq = 0;

/** Chave local do bloco no rascunho (só para o React e os inputs). */
export function draftKey(): string {
  draftSeq += 1;
  return `draft-${draftSeq}`;
}

export function emptyDraftBlock(kind: BlockKind): DraftBlock {
  return { key: draftKey(), kind, content: "", minutes: "60" };
}

export function newDayDraft(date: string): DayDraft {
  return {
    mode: "new",
    date,
    phase: "",
    blocks: [emptyDraftBlock("A"), emptyDraftBlock("B")],
  };
}

export function dayDraftFromDay(day: PlanDay): DayDraft {
  return {
    mode: "edit",
    date: day.date,
    phase: day.phase ?? "",
    blocks: day.blocks.length
      ? day.blocks.map((block) => ({
          key: draftKey(),
          kind: block.kind,
          content: block.content,
          minutes: block.plannedMin > 0 ? String(block.plannedMin) : "",
        }))
      : [emptyDraftBlock("A")],
  };
}

export type DraftResult = { ok: true; day: PlanDay } | { ok: false; error: string };

/**
 * Valida e monta o dia. As regras são as mesmas de antes do redesenho:
 * data válida, minutos legíveis, um bloco por tipo e pelo menos um tópico.
 */
export function buildDayFromDraft(draft: DayDraft): DraftResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    return { ok: false, error: "Escolha uma data válida." };
  }

  const blocks: PlanBlock[] = [];
  const seen = new Set<BlockKind>();
  for (const row of draft.blocks) {
    const content = row.content.replace(/\s+/g, " ").trim();
    const raw = row.minutes.trim();
    const plannedMin = raw === "" ? 0 : parseDuration(raw);
    if (plannedMin == null) {
      return {
        ok: false,
        error: `Minutos de ${KIND_LABEL[row.kind]} inválidos. Use 45, 1h30 ou 01:30.`,
      };
    }
    if (!content) continue;
    if (seen.has(row.kind)) {
      return {
        ok: false,
        error: `${KIND_LABEL[row.kind]} está repetido. Cada bloco aparece uma vez por dia.`,
      };
    }
    seen.add(row.kind);
    blocks.push({ kind: row.kind, content, plannedMin });
  }
  if (!blocks.length) {
    return { ok: false, error: "Preencha o tópico de pelo menos um bloco." };
  }
  return {
    ok: true,
    day: { date: draft.date, phase: draft.phase.trim(), blocks },
  };
}
