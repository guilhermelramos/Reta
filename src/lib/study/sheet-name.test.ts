import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SHEET_NAME,
  displaySheetName,
  sheetNameFromFile,
} from "./sheet-name.ts";

describe("sheet-name: nome salvo a partir do arquivo", () => {
  it("remove a extensão do nome do arquivo", () => {
    assert.equal(sheetNameFromFile("enem-reta-final.xlsx"), "enem-reta-final");
    assert.equal(sheetNameFromFile("plano de estudo.csv"), "plano de estudo");
    assert.equal(sheetNameFromFile("rotina.xls"), "rotina");
  });

  it("mantém pontos que fazem parte do nome", () => {
    assert.equal(sheetNameFromFile("enem.reta.final.xlsx"), "enem.reta.final");
    assert.equal(sheetNameFromFile("plano"), "plano");
  });

  it("ignora o caminho que o navegador às vezes envia", () => {
    assert.equal(sheetNameFromFile("C:\\fakepath\\enem-reta.xlsx"), "enem-reta");
    assert.equal(sheetNameFromFile("/tmp/plano/rotina.csv"), "rotina");
  });

  it("usa o nome padrão quando não há arquivo ou só extensão", () => {
    assert.equal(sheetNameFromFile(), DEFAULT_SHEET_NAME);
    assert.equal(sheetNameFromFile(null), DEFAULT_SHEET_NAME);
    assert.equal(sheetNameFromFile(""), DEFAULT_SHEET_NAME);
    assert.equal(sheetNameFromFile("   "), DEFAULT_SHEET_NAME);
    assert.equal(sheetNameFromFile(".xlsx"), DEFAULT_SHEET_NAME);
    assert.equal(sheetNameFromFile("C:\\fakepath\\"), DEFAULT_SHEET_NAME);
  });

  it("não altera o nome de um arquivo já sem extensão", () => {
    assert.equal(sheetNameFromFile("  enem  "), "enem");
  });
});

describe("sheet-name: nome exibido de planos salvos", () => {
  it("troca o nome genérico antigo por Minha planilha", () => {
    assert.equal(displaySheetName("Plano"), DEFAULT_SHEET_NAME);
    assert.equal(displaySheetName("  plano  "), DEFAULT_SHEET_NAME);
  });

  it("preserva nomes reais", () => {
    assert.equal(displaySheetName("Plano ENEM"), "Plano ENEM");
    assert.equal(displaySheetName("enem-reta-final"), "enem-reta-final");
  });

  it("devolve vazio quando não há nome gravado", () => {
    assert.equal(displaySheetName(), "");
    assert.equal(displaySheetName("   "), "");
  });
});
