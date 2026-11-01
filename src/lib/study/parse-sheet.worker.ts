import { readWorkbook } from "./parse-sheet-workbook.ts";
import type { ParseSheetResponse } from "./parse-sheet-protocol.ts";

/**
 * Worker dedicado à leitura da planilha (xlsx/csv). O decode do arquivo é a
 * parte pesada e roda aqui, sem travar a thread principal da UI.
 *
 * Protocolo: recebe o `ArrayBuffer` do arquivo e responde com as abas já
 * normalizadas (ou uma mensagem de erro, para o arquivo corrompido).
 */
type WorkerScope = {
  onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null;
  postMessage: (response: ParseSheetResponse) => void;
};

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  try {
    scope.postMessage({ ok: true, sheets: readWorkbook(event.data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scope.postMessage({ ok: false, error: message });
  }
};
