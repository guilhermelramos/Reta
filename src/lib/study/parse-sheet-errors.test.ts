import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import {
  applyMap,
  emptyMap,
  guessMap,
  missingRequiredColumns,
  pickSheet,
  REQUIRED_COLUMNS,
} from "./parse-sheet.ts";
import { readWorkbookOffThread, SheetReadError } from "./parse-sheet-client.ts";
import { buildTemplateWorkbook, readWorkbook } from "./parse-sheet-workbook.ts";

const HEADERS = ["Data", "Bloco A", "Min A", "Bloco B", "Min B", "Revisão", "Min Rev"];

function xlsxBytes(rows: unknown[][]): ArrayBuffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Plano");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("parse-sheet: arquivo vazio", () => {
  it("rejeita um ArrayBuffer vazio com erro classificado", async () => {
    await assert.rejects(
      () => readWorkbookOffThread(new ArrayBuffer(0)),
      (error: unknown) => error instanceof SheetReadError && error.code === "empty",
    );
  });

  it("devolve nenhuma aba quando o .xlsx não tem células", async () => {
    const sheets = await readWorkbookOffThread(xlsxBytes([]));
    assert.deepEqual(sheets, []);
  });
});

describe("parse-sheet: arquivo corrompido", () => {
  it("transforma o erro do leitor em SheetReadError('corrupted')", async () => {
    // Cabeçalho de ZIP (PK) sem um .xlsx válido dentro: o leitor falha.
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]).buffer;
    await assert.rejects(
      () => readWorkbookOffThread(bytes),
      (error: unknown) => error instanceof SheetReadError && error.code === "corrupted",
    );
  });

  it("lê normalmente um .xlsx válido no fallback síncrono (sem Worker no Node)", async () => {
    const sheets = await readWorkbookOffThread(buildTemplateWorkbook());
    assert.equal(sheets.length, 1);
    assert.equal(pickSheet(sheets)?.name, "Plano");
  });
});

describe("parse-sheet: colunas obrigatórias", () => {
  it("lista todas as colunas quando o mapeamento está vazio", () => {
    assert.deepEqual(missingRequiredColumns(emptyMap()), REQUIRED_COLUMNS);
  });

  it("aponta só o que falta e aceita a planilha completa", () => {
    const partial = guessMap(["Data", "Bloco A", "Min A", "Bloco B", "Min B", "Revisão"]);
    assert.deepEqual(missingRequiredColumns(partial), ["minR"]);

    const complete = guessMap(HEADERS);
    assert.deepEqual(missingRequiredColumns(complete), []);
  });

  it("detecta planilha sem as colunas de tempo como incompleta", () => {
    const map = guessMap(["Data", "Bloco A", "Bloco B", "Revisão"]);
    assert.deepEqual(missingRequiredColumns(map), ["minA", "minB", "minR"]);
  });
});

describe("parse-sheet: datas inválidas", () => {
  it("ignora linhas com data ilegível e avisa linha por linha", () => {
    const { days, warnings } = applyMap(
      [
        HEADERS,
        ["sem data", "Matemática", "30", "Física", "20", "Revisão", "10"],
        ["31/02/2026", "Biologia", "30", "Química", "20", "Revisão", "10"],
        ["2026-13-01", "História", "30", "Geografia", "20", "Revisão", "10"],
      ],
      0,
      guessMap(HEADERS),
    );

    assert.deepEqual(days, []);
    const invalid = warnings.filter((warning) => warning.message.startsWith("Data inválida"));
    assert.equal(invalid.length, 3);
    assert.deepEqual(invalid.map((warning) => warning.row), [2, 3, 4]);
  });

  it("mantém as linhas válidas quando só parte das datas está errada", () => {
    const { days, warnings } = applyMap(
      [
        HEADERS,
        ["01/04/2026", "Matemática", "30", "Física", "20", "Revisão", "10"],
        ["32/04/2026", "Biologia", "30", "Química", "20", "Revisão", "10"],
      ],
      0,
      guessMap(HEADERS),
    );

    assert.deepEqual(days.map((day) => day.date), ["2026-04-01"]);
    assert.equal(warnings.filter((warning) => warning.message.startsWith("Data inválida")).length, 1);
  });
});

describe("parse-sheet: planilha antiga com bloco de leitura", () => {
  it("continua lendo o .xlsx já salvo, mas não importa a coluna Leitura", () => {
    const headers = [...HEADERS, "Leitura", "Min L"];
    const tables = readWorkbook(
      xlsxBytes([
        headers,
        ["06/04/2026", "Matemática", "40", "Física", "20", "Revisão", "10", "Ler capítulo 2", "25"],
      ]),
    );
    const best = pickSheet(tables);
    assert.ok(best);
    const { days } = applyMap(best.matrix, best.headerRow, guessMap(best.headers));
    assert.deepEqual(days[0]!.blocks.map((block) => block.kind), ["A", "B", "R"]);
  });
});
