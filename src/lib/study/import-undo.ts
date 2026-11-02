/**
 * Desfazer da importação de planilha.
 *
 * A tela Importar guarda um retrato do plano anterior antes de substituí-lo e
 * o snackbar oferece **Desfazer** por 8 s. Só o plano e os dois campos de
 * `meta` que dizem qual planilha está ativa entram no retrato: histórico de
 * sessões, pacotes e erros nunca são tocados.
 *
 * Fica fora do React para os testes em Node cobrirem a cópia profunda dos dias
 * (o snapshot não pode mudar se a lista original for alterada depois).
 */

import type { PlanDay } from "./types.ts";

export type PlanUndo = {
  days: PlanDay[];
  /** `meta.activeSheet` de antes da importação (vazio no plano de exemplo). */
  sheetName: string;
  /** `meta.seeded` de antes da importação. */
  seeded: boolean;
};

/** Cópia independente dos dias, incluindo cada bloco. */
function cloneDays(days: PlanDay[]): PlanDay[] {
  return days.map((day) => ({
    ...day,
    blocks: day.blocks.map((block) => ({ ...block })),
  }));
}

/** Retrato do plano anterior, tirado antes de `importDays` substituir tudo. */
export function snapshotPlan({
  days,
  sheetName,
  seeded,
}: {
  days: PlanDay[];
  sheetName: string;
  seeded: boolean;
}): PlanUndo {
  return { days: cloneDays(days), sheetName, seeded };
}

/**
 * Cópia pronta para gravar ao desfazer. Devolve uma nova cópia para o store
 * poder aplicar sem compartilhar referências com o snapshot guardado na tela.
 */
export function restorePlan(undo: PlanUndo): PlanUndo {
  return {
    days: cloneDays(undo.days),
    sheetName: undo.sheetName,
    seeded: undo.seeded,
  };
}
