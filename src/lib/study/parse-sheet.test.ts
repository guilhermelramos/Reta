import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyManualMap, applyMap, emptyMap, guessMap, manualHeaderRow, manualHeaders, pickSheet } from "./parse-sheet.ts";
import { buildTemplateWorkbook, readWorkbook } from "./parse-sheet-workbook.ts";

const HEADERS = [
  "Dia / fase",
  "Data",
  "Bloco A",
  "Min A",
  "Bloco B",
  "Min B",
  "Revisão",
  "Min Rev",
];

function parse(rows: string[][]) {
  const matrix = [HEADERS, ...rows];
  return applyMap(matrix, 0, guessMap(HEADERS));
}

describe("parse-sheet: datas repetidas", () => {
  it("manda o segundo Bloco A para o Bloco B quando ele está vazio", () => {
    const { days, warnings } = parse([
      ["Fase 1", "10/03/2026", "Matemática: Funções", "40", "", "", "Revisão de ontem", "15"],
      ["Fase 2", "10/03/2026", "Física: Leis de Ohm", "30", "", "", "Revisão de ontem", "15"],
    ]);

    assert.equal(days.length, 1);
    const day = days[0]!;
    assert.equal(day.date, "2026-03-10");
    assert.equal(day.phase, "Fase 1");
    const byKind = new Map(day.blocks.map((b) => [b.kind, b]));
    assert.equal(byKind.get("A")?.content, "Matemática: Funções");
    assert.equal(byKind.get("A")?.plannedMin, 40);
    assert.equal(byKind.get("B")?.content, "Física: Leis de Ohm");
    assert.equal(byKind.get("B")?.plannedMin, 30);
    assert.equal(byKind.get("R")?.content, "Revisão de ontem");
    assert.equal(byKind.get("R")?.plannedMin, 15);
    assert.equal(
      warnings.some((w) => w.message === "2026-03-10: 2 linhas mescladas no mesmo dia"),
      true,
      warnings.map((w) => w.message).join(" | "),
    );
  });

  it("concatena 'Tópico 1 + Tópico 2' e soma os minutos quando os dois blocos já estão cheios", () => {
    const { days } = parse([
      [
        "Fase 1",
        "11/03/2026",
        "Biologia: Citologia",
        "50",
        "Química: Estequiometria",
        "40",
        "Revisão: mapa mental",
        "10",
      ],
      [
        "Fase 1",
        "11/03/2026",
        "História: República Velha",
        "25",
        "Geografia: Clima",
        "20",
        "Revisão: flashcards",
        "5",
      ],
      ["Fase 1", "11/03/2026", "Sociologia: Durkheim", "15", "", "", "", ""],
    ]);

    assert.equal(days.length, 1);
    const blocks = days[0]!.blocks;
    const byKind = new Map(blocks.map((b) => [b.kind, b]));
    // Terceira linha: A já cheio e B já cheio → concatena nos dois.
    assert.equal(
      byKind.get("A")?.content,
      "Biologia: Citologia + História: República Velha + Sociologia: Durkheim",
    );
    assert.equal(byKind.get("A")?.plannedMin, 90);
    assert.equal(byKind.get("B")?.content, "Química: Estequiometria + Geografia: Clima");
    assert.equal(byKind.get("B")?.plannedMin, 60);
    assert.equal(byKind.get("R")?.content, "Revisão: mapa mental + Revisão: flashcards");
    assert.equal(byKind.get("R")?.plannedMin, 15);
    assert.deepEqual(
      blocks.map((b) => b.kind),
      ["A", "B", "R"],
    );
  });

  it("conta as linhas mescladas por dia e não avisa em dias únicos", () => {
    const { days, warnings } = parse([
      ["Fase 1", "12/03/2026", "Matemática: PA", "30", "", "", "Revisão", "10"],
      ["Fase 1", "12/03/2026", "Matemática: PG", "30", "", "", "", ""],
      ["Fase 1", "12/03/2026", "Matemática: Log", "30", "", "", "", ""],
      ["Fase 1", "13/03/2026", "Física: Óptica", "45", "", "", "Revisão", "10"],
    ]);

    assert.equal(days.length, 2);
    const merged = warnings.filter((w) => /mescladas no mesmo dia/.test(w.message));
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.message, "2026-03-12: 3 linhas mescladas no mesmo dia");
    assert.equal(merged[0]!.row, 4);
    assert.equal(
      warnings.some((w) => /repetida/.test(w.message)),
      false,
    );
  });
});

describe("parse-sheet: mapeamento manual", () => {
  const headers = ["Data", "Matéria", "Tempo", "Matéria 2", "Tempo 2", "Revisão"];

  function sheet(matrix: string[][]) {
    // headerRow -1 simula a detecção automática que falhou.
    return { name: "Plano", headers: [], headerRow: -1, matrix };
  }

  it("usa a linha logo acima do primeiro dia como cabeçalho", () => {
    const table = sheet([
      ["Meu cronograma", "", "", "", "", ""],
      headers,
      ["01/04/2026", "Matemática: Log", "30", "Física: Óptica", "20", "Revisão: 5 questões"],
    ]);
    assert.equal(manualHeaderRow(table), 1);
    assert.deepEqual(manualHeaders(table), headers);

    const map = { ...emptyMap(), date: 0, contentA: 1, minA: 2, contentB: 3, minB: 4, contentR: 5 };
    const { days, warnings } = applyManualMap(table, map);
    assert.equal(days.length, 1);
    assert.equal(days[0]!.date, "2026-04-01");
    assert.deepEqual(days[0]!.blocks.map((b) => [b.kind, b.content, b.plannedMin]), [
      ["A", "Matemática: Log", 30],
      ["B", "Física: Óptica", 20],
      ["R", "Revisão: 5 questões", 0],
    ]);
    assert.deepEqual(warnings, []);
  });

  it("não descarta o primeiro dia quando a planilha já começa nos dados", () => {
    const table = sheet([
      ["02/04/2026", "Química: pH", "25", "", "", ""],
      ["03/04/2026", "Biologia: Ecologia", "40", "", "", ""],
    ]);
    assert.equal(manualHeaderRow(table), -1);
    assert.deepEqual(manualHeaders(table), ["Coluna 1", "Coluna 2", "Coluna 3", "Coluna 4", "Coluna 5", "Coluna 6"]);

    const map = { ...emptyMap(), date: 0, contentA: 1, minA: 2 };
    const { days } = applyManualMap(table, map);
    assert.deepEqual(days.map((d) => d.date), ["2026-04-02", "2026-04-03"]);
  });
});

describe("parse-sheet: planilha modelo", () => {
  it("gera um .xlsx que o próprio parser reconhece, só com as colunas pedidas", () => {
    const tables = readWorkbook(buildTemplateWorkbook());
    const best = pickSheet(tables);
    assert.ok(best, "a planilha modelo precisa ser detectada automaticamente");
    assert.equal(best.name, "Plano");
    assert.deepEqual(best.headers, ["Data", "Bloco A", "Min A", "Bloco B", "Min B", "Revisão", "Min Rev"]);

    const { days } = applyMap(best.matrix, best.headerRow, guessMap(best.headers));
    assert.equal(days.length, 3);
    assert.equal(days[0]!.date, "2026-03-02");
    assert.deepEqual(days[0]!.blocks.map((b) => b.kind), ["A", "B", "R"]);
    assert.equal(days[0]!.blocks.find((b) => b.kind === "R")?.plannedMin, 20);
  });
});

describe("parse-sheet: colunas de leitura", () => {
  it("ignora Leitura/escrita e não cria bloco L na importação", () => {
    const headers = [
      "Data",
      "Bloco A",
      "Min A",
      "Bloco B",
      "Min B",
      "Revisão",
      "Min Rev",
      "Leitura",
      "Min L/E",
    ];
    const map = guessMap(headers);
    assert.equal("contentL" in map, false);
    assert.equal("minL" in map, false);

    const { days } = applyMap(
      [
        headers,
        ["05/03/2026", "Matemática", "30", "Física", "20", "Revisão", "10", "Ler um capítulo", "15"],
      ],
      0,
      map,
    );
    assert.deepEqual(days[0]!.blocks.map((b) => b.kind), ["A", "B", "R"]);
  });
});
