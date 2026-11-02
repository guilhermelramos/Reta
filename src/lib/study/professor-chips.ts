/**
 * Chips da folha do Professor IA.
 *
 * A revisão P3 pediu uma única linha horizontal rolável acima do campo de
 * texto: perguntas rápidas (só antes da primeira mensagem), atalhos de sempre
 * e as ações locais (desenho e teste). A ordem e a visibilidade ficam aqui,
 * fora do componente, para serem testadas com `node --test`.
 */

import { quickQuestionsVisible } from "./chat-ui.ts";

export type ProfessorChipKind = "ask" | "draw" | "test";

export type ProfessorChip = {
  id: string;
  label: string;
  kind: ProfessorChipKind;
};

/** Perguntas de 1 toque: evitam digitação longa no teclado do celular. */
export const QUICK_QUESTIONS = [
  "Me dê uma dica sem entregar a resposta",
  "Por que a minha alternativa está errada?",
  "Qual é a pegadinha desta questão?",
  "Resuma a fórmula/conceito em 3 linhas",
] as const;

/** Atalhos que continuam disponíveis depois da primeira mensagem. */
export const SHORTCUTS = [
  "Explique de outro jeito",
  "Dê um exemplo",
  "Resuma em 3 linhas",
  "Qual é a pegadinha?",
] as const;

function askChips(labels: readonly string[]): ProfessorChip[] {
  return labels.map((label) => ({ id: `ask:${label}`, label, kind: "ask" }));
}

/**
 * Linha única de chips: perguntas rápidas (conversa vazia) + atalhos + ações.
 * Nenhum rótulo tem quebra de linha — o container rola na horizontal.
 */
export function professorChips(sentCount: number): ProfessorChip[] {
  return [
    ...(quickQuestionsVisible(sentCount) ? askChips(QUICK_QUESTIONS) : []),
    ...askChips(SHORTCUTS),
    { id: "draw", label: "Desenhe isso em SVG", kind: "draw" },
    { id: "test", label: "Me teste nisso", kind: "test" },
  ];
}

/** Rótulo do assist chip do cabeçalho: mostra o destino do toque. */
export function notebookChipLabel(tab: "chat" | "caderno"): "Caderno" | "Conversa" {
  return tab === "chat" ? "Caderno" : "Conversa";
}
