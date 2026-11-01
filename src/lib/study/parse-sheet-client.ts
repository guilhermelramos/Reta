import type { ParseSheetResponse } from "./parse-sheet-protocol.ts";
import type { SheetTable } from "./types.ts";

export type SheetReadErrorCode = "empty" | "corrupted";

/** Erro de leitura da planilha já classificado para a tela mostrar a mensagem certa. */
export class SheetReadError extends Error {
  readonly code: SheetReadErrorCode;

  constructor(code: SheetReadErrorCode, message: string) {
    super(message);
    this.name = "SheetReadError";
    this.code = code;
  }
}

/** `false` em ambientes sem Web Worker (ex.: testes no Node) — aí cai no fallback. */
export function canUseWorker(): boolean {
  return typeof Worker !== "undefined";
}

const WORKER_TIMEOUT_MS = 30_000;

/**
 * Lê o .xlsx/.csv num Web Worker (Vite empacota o worker como módulo separado).
 * O fallback síncrono só existe para ambientes que não têm `Worker`.
 */
export async function readWorkbookOffThread(data: ArrayBuffer): Promise<SheetTable[]> {
  if (data.byteLength === 0) {
    throw new SheetReadError("empty", "O arquivo está vazio.");
  }
  if (!canUseWorker()) return readWorkbookSync(data);
  return readWorkbookInWorker(data);
}

async function readWorkbookSync(data: ArrayBuffer): Promise<SheetTable[]> {
  try {
    const { readWorkbook } = await import("./parse-sheet-workbook.ts");
    return readWorkbook(data);
  } catch (error) {
    throw asCorrupted(error);
  }
}

function readWorkbookInWorker(data: ArrayBuffer): Promise<SheetTable[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./parse-sheet.worker.ts", import.meta.url), { type: "module" });
    } catch (error) {
      reject(asCorrupted(error));
      return;
    }

    let settled = false;
    const finish = (result: { sheets: SheetTable[] } | { error: unknown }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if ("sheets" in result) resolve(result.sheets);
      else reject(asCorrupted(result.error));
    };

    const timer = setTimeout(() => {
      finish({ error: new Error("A leitura da planilha demorou demais.") });
    }, WORKER_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<ParseSheetResponse>) => {
      const response = event.data;
      if (response.ok) finish({ sheets: response.sheets });
      else finish({ error: new Error(response.error) });
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish({ error: new Error(event.message || "Falha ao ler a planilha.") });
    };
    worker.onmessageerror = () => {
      finish({ error: new Error("Resposta inválida do leitor de planilhas.") });
    };

    worker.postMessage(data, [data]);
  });
}

function asCorrupted(error: unknown): SheetReadError {
  if (error instanceof SheetReadError) return error;
  const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
  return new SheetReadError(
    "corrupted",
    `Não consegui ler o arquivo como planilha.${detail}`.trim(),
  );
}
