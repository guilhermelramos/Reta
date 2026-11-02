/**
 * Textos e resumos da tela Importar.
 *
 * Fica fora do React para os testes em Node cobrirem exatamente as frases que
 * a pessoa lê antes de confirmar a importação: o resumo do período, as
 * primeiras linhas da prévia, o estado do plano atual e o snackbar de sucesso.
 */

import { REQUIRED_COLUMNS } from "./parse-sheet.ts";
import { displaySheetName } from "./sheet-name.ts";
import { formatMin } from "./time.ts";
import type { BlockKind, ColumnMap, PlanDay, RowWarning } from "./types.ts";
import { KIND_LABEL } from "./types.ts";

/** Quantas linhas do plano a pré-visualização mostra antes de importar. */
export const PREVIEW_ROW_LIMIT = 3;

/** `2026-03-04` → `04/03` (a chave já vem validada do parser). */
export function dayMonth(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return month && day ? `${day}/${month}` : dateKey;
}

/** `04/03 a 30/06`, ou só `04/03` quando começa e termina no mesmo dia. */
export function rangeLabel(firstDate: string, lastDate: string): string {
  if (!firstDate && !lastDate) return "";
  if (!firstDate) return dayMonth(lastDate);
  if (!lastDate) return dayMonth(firstDate);
  return firstDate === lastDate
    ? dayMonth(firstDate)
    : `${dayMonth(firstDate)} a ${dayMonth(lastDate)}`;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function sortedDays(days: PlanDay[]): PlanDay[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

export type ImportSummary = {
  dayCount: number;
  blockCount: number;
  firstDate: string;
  lastDate: string;
  /** Ex.: "12 dias, de 04/03 a 30/06, 28 blocos". */
  label: string;
};

/**
 * Resumo curto do plano lido: "N dias, de DD/MM a DD/MM, M blocos".
 * Devolve `null` quando não há nenhum dia válido para importar.
 */
export function importSummary(days: PlanDay[]): ImportSummary | null {
  if (!days.length) return null;
  const ordered = sortedDays(days);
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const dayCount = ordered.length;
  const blockCount = ordered.reduce((total, day) => total + day.blocks.length, 0);
  const range =
    dayCount === 1
      ? `em ${dayMonth(first.date)}`
      : `de ${dayMonth(first.date)} a ${dayMonth(last.date)}`;
  return {
    dayCount,
    blockCount,
    firstDate: first.date,
    lastDate: last.date,
    label: `${dayCount} ${plural(dayCount, "dia", "dias")}, ${range}, ${blockCount} ${plural(
      blockCount,
      "bloco",
      "blocos",
    )}`,
  };
}

export type PreviewBlock = {
  kind: BlockKind;
  label: string;
  content: string;
  minutes: string;
};

export type PreviewRow = {
  date: string;
  /** `04/03` — a data da linha da planilha. */
  label: string;
  blockCount: number;
  blockCountLabel: string;
  totalMinutes: number;
  totalLabel: string;
  blocks: PreviewBlock[];
};

/** Conteúdo de uma linha, curto o bastante para caber num cartão de celular. */
export function shortContent(content: string, max = 64): string {
  const text = content.trim().replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Primeiras linhas do plano para a lista compacta da pré-visualização.
 * Cada dia importado é uma linha, com os blocos que vieram dela.
 */
export function importPreviewRows(
  days: PlanDay[],
  limit = PREVIEW_ROW_LIMIT,
): PreviewRow[] {
  return sortedDays(days)
    .slice(0, Math.max(0, limit))
    .map((day) => {
      const totalMinutes = day.blocks.reduce((total, block) => total + block.plannedMin, 0);
      const blockCount = day.blocks.length;
      return {
        date: day.date,
        label: dayMonth(day.date),
        blockCount,
        blockCountLabel: `${blockCount} ${plural(blockCount, "bloco", "blocos")}`,
        totalMinutes,
        totalLabel: formatMin(totalMinutes),
        blocks: day.blocks.map((block) => ({
          kind: block.kind,
          label: KIND_LABEL[block.kind],
          content: shortContent(block.content),
          minutes: formatMin(block.plannedMin),
        })),
      };
    });
}

/** Texto do snackbar depois de salvar. Ex.: "Plano importado · 12 dias". */
export function importedMessage(dayCount: number): string {
  const count = Math.max(0, Math.round(dayCount));
  return `Plano importado · ${count} ${plural(count, "dia", "dias")}`;
}

/** Texto do snackbar depois de desfazer a importação. */
export const IMPORT_UNDO_MESSAGE = "Importação desfeita · plano anterior restaurado";

export type PreviewProblem = {
  kind: "problem";
  key: string;
  /** Linha da planilha (1-based), como o parser reporta. */
  row: number;
  message: string;
};

export type PreviewDay = {
  kind: "day";
  key: string;
  row: PreviewRow;
};

export type PreviewItem = PreviewProblem | PreviewDay;

/**
 * Itens da prévia na ordem de leitura: primeiro as linhas que o parser não
 * conseguiu usar, das mais antigas para as mais novas, e só depois os dias
 * válidos. Assim um problema escondido no fim da planilha não fica abaixo de
 * três cartões de dia válidos (ou fora da dobra).
 */
export function importPreviewItems(
  days: PlanDay[],
  warnings: RowWarning[] = [],
  limit = PREVIEW_ROW_LIMIT,
): PreviewItem[] {
  const problems: PreviewProblem[] = warnings
    .map((warning, index) => ({
      kind: "problem" as const,
      key: `problem-${warning.row}-${index}`,
      row: warning.row,
      message: warning.message,
    }))
    .sort((a, b) => a.row - b.row);
  const valid: PreviewDay[] = importPreviewRows(days, limit).map((row) => ({
    kind: "day" as const,
    key: `day-${row.date}`,
    row,
  }));
  return [...problems, ...valid];
}

/** Quantos itens da prévia são dias válidos (para o "e mais N dias"). */
export function previewDayCount(items: PreviewItem[]): number {
  return items.reduce((total, item) => total + (item.kind === "day" ? 1 : 0), 0);
}

export type RecognizedColumns = {
  recognized: number;
  total: number;
  /** Ex.: "Reconhecidas automaticamente (7/7)". */
  label: string;
};

/**
 * Quantas colunas obrigatórias o parser reconheceu sozinho. É o subtítulo do
 * acordeão "Ajustar colunas"; o total é sempre o das colunas necessárias.
 */
export function recognizedColumns(map: ColumnMap | null): RecognizedColumns {
  const total = REQUIRED_COLUMNS.length;
  const recognized = map
    ? REQUIRED_COLUMNS.filter((key) => map[key] != null).length
    : 0;
  return {
    recognized,
    total,
    label: `Reconhecidas automaticamente (${recognized}/${total})`,
  };
}

export type CurrentPlanSummary = {
  /** `true` quando o plano atual veio de uma planilha importada. */
  imported: boolean;
  title: string;
  /** Período e quantidade de dias; vazio quando não há plano. */
  detail: string;
  dayCount: number;
};

/**
 * Cartão de estado atual da tela Importar.
 *
 * O plano semeado (modelo de exemplo) conta como "Nenhuma planilha importada":
 * `seeded` é a mesma flag que o onboarding usa para saber se o usuário já
 * trouxe uma planilha. O nome só existe depois da primeira importação; para
 * planos antigos, sem nome gravado, usamos um rótulo neutro. Um nome gravado
 * vence a flag `seeded` (versões anteriores não a atualizavam ao importar).
 */
export function currentPlanSummary({
  days,
  seeded,
  sheetName,
}: {
  days: PlanDay[];
  seeded: boolean;
  sheetName?: string;
}): CurrentPlanSummary {
  const ordered = sortedDays(days);
  const dayCount = ordered.length;
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const period =
    first && last
      ? `${rangeLabel(first.date, last.date)} · ${dayCount} ${plural(dayCount, "dia", "dias")}`
      : "";
  const named = Boolean(sheetName?.trim());

  // `seeded` pode ficar antigo em planos importados por versões anteriores;
  // o nome da planilha gravado é a outra prova de que houve importação.
  if (dayCount === 0 || (seeded && !named)) {
    return {
      imported: false,
      title: "Nenhuma planilha importada",
      detail: dayCount ? `Plano de exemplo · ${period}` : "Nenhum dia no plano ainda.",
      dayCount,
    };
  }

  const name = displaySheetName(sheetName);
  return {
    imported: true,
    title: name || "Planilha importada",
    detail: period,
    dayCount,
  };
}
