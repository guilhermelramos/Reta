import * as XLSXImport from "xlsx";
import { findHeader, TEMPLATE_HEADERS } from "./parse-sheet.ts";
import { utcKeyFromDate } from "./time.ts";
import type { SheetTable } from "./types.ts";

/**
 * Leitura do arquivo binário (.xlsx/.csv). Fica separada do parser puro para
 * que o `xlsx` só seja carregado no Web Worker — a thread principal não paga
 * esse custo nem no primeiro carregamento da tela de importação.
 *
 * O fallback síncrono de `parse-sheet-client.ts` usa este módulo apenas em
 * ambientes sem `Worker`.
 */

type WorkBook = { SheetNames: string[]; Sheets: Record<string, unknown> };

function xlsx(): {
  read: (data: ArrayBuffer | string, opts: object) => WorkBook;
  utils: { sheet_to_json: (sheet: unknown, opts: object) => unknown[][] };
} {
  const mod = XLSXImport as unknown as { default?: typeof XLSXImport };
  return (mod.default ?? XLSXImport) as ReturnType<typeof xlsx>;
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

const TEMPLATE_HEADERS_ROW: (string | number)[] = [...TEMPLATE_HEADERS];

const TEMPLATE_ROWS: (string | number)[][] = [
  TEMPLATE_HEADERS_ROW,
  ["02/03/2026", "Matemática: Funções", 60, "Física: Leis de Ohm", 40, "Revisão: 10 questões de funções", 20],
  ["03/03/2026", "Biologia: Citologia", 50, "Química: Estequiometria", 45, "Revisão: mapa mental de citologia", 15],
  ["04/03/2026", "História: República Velha", 45, "", "", "Revisão: flashcards de história", 10],
];

/** Planilha modelo (.xlsx) montada no cliente, só com as colunas que o Reta importa. */
export function buildTemplateWorkbook(): ArrayBuffer {
  const worksheet = XLSXImport.utils.aoa_to_sheet(TEMPLATE_ROWS);
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 38 },
    { wch: 10 },
    { wch: 38 },
    { wch: 10 },
    { wch: 42 },
    { wch: 10 },
  ];
  const book = XLSXImport.utils.book_new();
  XLSXImport.utils.book_append_sheet(book, worksheet, "Plano");
  return XLSXImport.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
