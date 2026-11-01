import type { SheetTable } from "./types.ts";

/** Resposta do Web Worker que lê o .xlsx/.csv fora da thread principal. */
export type ParseSheetResponse =
  | { ok: true; sheets: SheetTable[] }
  | { ok: false; error: string };
