import type { ColumnKey, ColumnMap, PlanDay, RowWarning, SheetTable } from "./types.ts";
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

export function applyMap(
  matrix: string[][],
  headerRow: number,
  map: ColumnMap,
): { days: PlanDay[]; warnings: RowWarning[] } {
  const warnings: RowWarning[] = [];
  const byDate = new Map<string, PlanDay>();
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
    if (byDate.has(date)) warnings.push({ row: i + 1, message: `${date} repetida — ficou a última.` });
    byDate.set(date, { date, phase, blocks });
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
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
