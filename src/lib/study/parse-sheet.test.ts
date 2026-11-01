import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyMap, guessMap } from "./parse-sheet.ts";

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
