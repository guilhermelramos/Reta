import type {
  BlockKind,
  ColumnKey,
  ColumnMap,
  PlanBlock,
  PlanDay,
  RowWarning,
  SheetTable,
} from "./types.ts";
import { parseDateKey, parseDuration, utcKeyFromDate } from "./time.ts";
import * as XLSXImport from "xlsx";

type WorkBook = { SheetNames: string[]; Sheets: Record<string, unknown> };

function xlsx(): {
  read: (data: ArrayBuffer | string, opts: object) => WorkBook;
  utils: { sheet_to_json: (sheet: unknown, opts: object) => unknown[][] };
} {
  const mod = XLSXImport as unknown as { default?: typeof XLSXImport };
  return (mod.default ?? XLSXImport) as ReturnType<typeof xlsx>;
}

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return utcKeyFromDate(value);
  if (typeof value === "number") {
    if (value > 20000 && value < 80000) {
      const ms = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000;
      return utcKeyFromDate(new Date(ms));
    }
    return String(value);
  }
  return String(value).trim();
}

const MATCH: Record<ColumnKey, (h: string) => boolean> = {
  date: (h) => h === "data" || h === "date" || h === "dia",
  phase: (h) => /(fase|dia \/ fase|dia\/fase)/.test(h),
  contentA: (h) => h === "bloco a" || h === "conteudo a" || h === "conteudo a + tempo" || h === "a",
  minA: (h) => h === "min a" || h === "tempo a" || h === "minutos a" || /^min\.?\s*a$/.test(h),
  contentB: (h) => h === "bloco b" || h === "conteudo b" || h === "b",
  minB: (h) => h === "min b" || h === "tempo b" || h === "minutos b",
  contentR: (h) => /revis/.test(h) && !/min|tempo|real/.test(h),
  minR: (h) => /min/.test(h) && /rev/.test(h),
  contentL: (h) => /(leitura|escrita)/.test(h) && !/^min/.test(h),
  minL: (h) => /^min/.test(h) && /(l\/e|leitura|escrita|\bl\b)/.test(h),
};

export function guessMap(headers: string[]): ColumnMap {
  const used = new Set<number>();
  const map = emptyMap();
  const keys = Object.keys(MATCH) as ColumnKey[];
  for (const key of keys) {
    const idx = headers.findIndex((h, i) => !used.has(i) && MATCH[key](norm(h)));
    if (idx >= 0) {
      map[key] = idx;
      used.add(idx);
    }
  }
  return map;
}

export function emptyMap(): ColumnMap {
  return {
    date: null,
    phase: null,
    contentA: null,
    minA: null,
    contentB: null,
    minB: null,
    contentR: null,
    minR: null,
    contentL: null,
    minL: null,
  };
}

function findHeader(matrix: string[][]): number {
  const limit = Math.min(matrix.length, 40);
  for (let i = 0; i < limit; i++) {
    const headers = matrix[i].map(norm);
    const hasDate = headers.some((h) => h === "data" || h === "date");
    const hasA = headers.some((h) => MATCH.contentA(h));
    if (hasDate && hasA) return i;
  }
  return -1;
}

export function readWorkbook(data: ArrayBuffer): SheetTable[] {
  const book = xlsx().read(data, { type: "array", cellDates: true });
  return book.SheetNames.map((name) => {
    const rows = xlsx().utils.sheet_to_json(book.Sheets[name], {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });
    const matrix = rows.map((row) => (Array.isArray(row) ? row : []).map(cellText));
    const headerRow = findHeader(matrix);
    const headers = headerRow >= 0 ? matrix[headerRow] : [];
    return { name, headers, headerRow, matrix };
  }).filter((sheet) => sheet.matrix.length > 0);
}

export function pickSheet(sheets: SheetTable[]): SheetTable | null {
  if (!sheets.length) return null;
  const ranked = [...sheets].sort((a, b) => scoreSheet(b) - scoreSheet(a));
  return ranked[0]?.headerRow >= 0 ? ranked[0] : null;
}

function scoreSheet(sheet: SheetTable): number {
  if (sheet.headerRow < 0) return -1;
  let score = 10;
  if (/plano/i.test(sheet.name)) score += 20;
  const map = guessMap(sheet.headers);
  if (map.date != null) score += 5;
  if (map.contentA != null) score += 5;
  if (map.contentB != null) score += 2;
  if (map.contentR != null) score += 2;
  return score;
}

const KIND_ORDER: BlockKind[] = ["A", "B", "R", "L"];
const BLANK_CONTENT = "Sem descrição";

/** Conteúdo realmente informado (ignora o placeholder de bloco só com tempo). */
function hasContent(block: PlanBlock | undefined): boolean {
  const text = block?.content.trim() ?? "";
  return Boolean(text) && text !== BLANK_CONTENT;
}

function sameContent(a: string, b: string): boolean {
  return norm(a) === norm(b);
}

/** Junta dois textos no formato "Tópico 1 + Tópico 2", sem repetir o mesmo tópico. */
function joinContent(current: string, incoming: string): { content: string; repeated: boolean } {
  const first = current.trim();
  const second = incoming.trim();
  const firstReal = Boolean(first) && first !== BLANK_CONTENT;
  const secondReal = Boolean(second) && second !== BLANK_CONTENT;
  if (!firstReal) return { content: secondReal ? second : first || second, repeated: false };
  if (!secondReal) return { content: first, repeated: false };
  if (sameContent(first, second)) return { content: first, repeated: true };
  return { content: `${first} + ${second}`, repeated: false };
}

function addBlock(blocks: PlanBlock[], block: PlanBlock, kind: BlockKind = block.kind): void {
  const existing = blocks.find((b) => b.kind === kind);
  if (!existing) {
    blocks.push({ kind, content: block.content, plannedMin: block.plannedMin });
    return;
  }
  const joined = joinContent(existing.content, block.content);
  existing.content = joined.content;
  if (!joined.repeated) existing.plannedMin += block.plannedMin;
}

function sortBlocks(blocks: PlanBlock[]): PlanBlock[] {
  return [...blocks].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

/**
 * Mescla uma linha repetida da planilha no dia já existente, em vez de descartá-la.
 * - Conteúdo novo de Bloco A vai para o Bloco B quando ele está livre.
 * - Sem espaço no B, concatena "Tópico 1 + Tópico 2" e soma os minutos.
 * - Revisões e leituras são preservadas (concatenadas quando diferentes).
 */
function mergeDay(base: PlanDay, next: PlanDay): PlanDay {
  const blocks = base.blocks.map((b) => ({ ...b }));
  const incomingB = next.blocks.some((b) => b.kind === "B" && hasContent(b));
  for (const block of next.blocks) {
    if (block.kind === "A") {
      const existingA = blocks.find((b) => b.kind === "A");
      const existingB = blocks.find((b) => b.kind === "B");
      const sameAsA = hasContent(existingA) && sameContent(existingA!.content, block.content);
      if (sameAsA) {
        addBlock(blocks, block, "A");
        continue;
      }
      if (hasContent(existingA) && !hasContent(existingB) && !incomingB) {
        addBlock(blocks, block, "B");
        continue;
      }
    }
    addBlock(blocks, block);
  }
  return {
    date: base.date,
    phase: base.phase.trim() ? base.phase : next.phase,
    blocks: sortBlocks(blocks),
  };
}

export function applyMap(
  matrix: string[][],
  headerRow: number,
  map: ColumnMap,
): { days: PlanDay[]; warnings: RowWarning[] } {
  const warnings: RowWarning[] = [];
  const byDate = new Map<string, PlanDay>();
  const merged = new Map<string, { count: number; row: number }>();
  if (map.date == null || map.contentA == null) {
    return { days: [], warnings: [{ row: headerRow + 1, message: "Faltou mapear Data ou conteúdo A." }] };
  }
  for (let i = headerRow + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (row.every((cell) => !cell.trim())) continue;
    const date = parseDateKey(row[map.date] ?? "");
    if (!date) {
      const blob = row.join(" ").trim();
      if (blob) warnings.push({ row: i + 1, message: "Data inválida — linha ignorada." });
      continue;
    }
    const phase = map.phase != null ? (row[map.phase] ?? "").trim() : "";
    const blocks = [
      readBlock(row, "A", map.contentA, map.minA, i + 1, warnings),
      readBlock(row, "B", map.contentB, map.minB, i + 1, warnings),
      readBlock(row, "R", map.contentR, map.minR, i + 1, warnings),
      readBlock(row, "L", map.contentL, map.minL, i + 1, warnings),
    ].filter((b): b is NonNullable<typeof b> => Boolean(b));
    if (!blocks.length) {
      warnings.push({ row: i + 1, message: `${date}: sem conteúdo A, B ou revisão.` });
      continue;
    }
    const previous = byDate.get(date);
    if (previous) {
      byDate.set(date, mergeDay(previous, { date, phase, blocks }));
      const seen = merged.get(date) ?? { count: 1, row: i + 1 };
      merged.set(date, { count: seen.count + 1, row: i + 1 });
    } else {
      byDate.set(date, { date, phase, blocks: sortBlocks(blocks) });
    }
  }
  for (const [date, info] of merged) {
    warnings.push({
      row: info.row,
      message: `${date}: ${info.count} linhas mescladas no mesmo dia`,
    });
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  warnings.sort((a, b) => a.row - b.row);
  return { days, warnings };
}

function readBlock(
  row: string[],
  kind: "A" | "B" | "R" | "L",
  contentIdx: number | null,
  minIdx: number | null,
  rowNumber: number,
  warnings: RowWarning[],
) {
  if (contentIdx == null) return null;
  const content = (row[contentIdx] ?? "").trim();
  let plannedMin = 0;
  if (minIdx != null) {
    const raw = (row[minIdx] ?? "").trim();
    if (!raw) plannedMin = 0;
    else {
      const parsed = parseDuration(raw);
      if (parsed == null) {
        warnings.push({ row: rowNumber, message: `Tempo do bloco ${kind} ilegível ("${raw}"). Usei 0.` });
        plannedMin = 0;
      } else plannedMin = parsed;
    }
  }
  if (!content && plannedMin <= 0) return null;
  return { kind, content: content || "Sem descrição", plannedMin };
}

export const COLUMN_FIELDS: { key: ColumnKey; label: string; required: boolean }[] = [
  { key: "date", label: "Data", required: true },
  { key: "phase", label: "Dia / fase (opcional)", required: false },
  { key: "contentA", label: "Conteúdo A", required: true },
  { key: "minA", label: "Tempo do A", required: true },
  { key: "contentB", label: "Conteúdo B", required: true },
  { key: "minB", label: "Tempo do B", required: true },
  { key: "contentR", label: "Revisão", required: true },
  { key: "minR", label: "Tempo da revisão", required: true },
  { key: "contentL", label: "Leitura (opcional)", required: false },
  { key: "minL", label: "Tempo da leitura", required: false },
];
