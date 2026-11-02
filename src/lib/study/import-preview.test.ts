import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  currentPlanSummary,
  dayMonth,
  importedMessage,
  importPreviewRows,
  importSummary,
  rangeLabel,
  shortContent,
} from "./import-preview.ts";
import type { BlockKind, PlanBlock, PlanDay } from "./types.ts";

function block(kind: BlockKind, plannedMin: number, content = `${kind} · conteúdo`): PlanBlock {
  return { kind, content, plannedMin };
}

function day(date: string, blocks: PlanBlock[], phase = ""): PlanDay {
  return { date, phase, blocks };
}

const PLAN: PlanDay[] = [
  day("2026-03-06", [block("A", 40, "Funções"), block("R", 20, "Revisão da semana")]),
  day("2026-03-04", [
    block("A", 50, "Trigonometria"),
    block("B", 40, "Logaritmos"),
    block("R", 20, "Revisão"),
  ]),
  day("2026-03-05", [block("B", 30, "Geometria analítica")]),
  day("2026-03-07", [block("A", 60, "Probabilidade")]),
];

describe("import-preview: resumo da pré-visualização", () => {
  it("resume N dias, período e total de blocos na ordem das datas", () => {
    const summary = importSummary(PLAN);
    assert.ok(summary);
    assert.equal(summary.dayCount, 4);
    assert.equal(summary.blockCount, 7);
    assert.equal(summary.firstDate, "2026-03-04");
    assert.equal(summary.lastDate, "2026-03-07");
    assert.equal(summary.label, "4 dias, de 04/03 a 07/03, 7 blocos");
  });

  it("usa singular para um dia e um bloco", () => {
    const summary = importSummary([day("2026-04-01", [block("A", 40)])]);
    assert.ok(summary);
    assert.equal(summary.label, "1 dia, em 01/04, 1 bloco");
  });

  it("não altera a lista recebida", () => {
    const original = PLAN.map((item) => item.date);
    importSummary(PLAN);
    assert.deepEqual(
      PLAN.map((item) => item.date),
      original,
    );
  });

  it("devolve null quando não há dia válido", () => {
    assert.equal(importSummary([]), null);
  });
});

describe("import-preview: primeiras linhas", () => {
  it("mostra no máximo três dias, os mais antigos primeiro", () => {
    const rows = importPreviewRows(PLAN);
    assert.deepEqual(
      rows.map((row) => row.label),
      ["04/03", "05/03", "06/03"],
    );
    assert.equal(rows[0]?.blockCount, 3);
    assert.equal(rows[0]?.totalMinutes, 110);
    assert.equal(rows[0]?.totalLabel, "1h50");
  });

  it("lista os blocos com rótulo e minutos de cada um", () => {
    const [row] = importPreviewRows([day("2026-03-04", [block("A", 40, "Funções"), block("R", 20)])]);
    assert.ok(row);
    assert.deepEqual(
      row.blocks.map((item) => `${item.label} ${item.minutes}`),
      ["Bloco A 40 min", "Revisão 20 min"],
    );
    assert.equal(row.blocks[0]?.content, "Funções");
    assert.equal(row.blockCountLabel, "2 blocos");
  });

  it("respeita um limite explícito", () => {
    assert.equal(importPreviewRows(PLAN, 1).length, 1);
    assert.equal(importPreviewRows(PLAN, 0).length, 0);
  });
});

describe("import-preview: textos auxiliares", () => {
  it("formata a data e o período em dd/mm", () => {
    assert.equal(dayMonth("2026-03-04"), "04/03");
    assert.equal(dayMonth("sem-data"), "sem-data");
    assert.equal(rangeLabel("2026-03-04", "2026-06-30"), "04/03 a 30/06");
    assert.equal(rangeLabel("2026-03-04", "2026-03-04"), "04/03");
  });

  it("encurta o conteúdo que não cabe na linha", () => {
    assert.equal(shortContent("  Funções   afins  "), "Funções afins");
    const long = shortContent("a".repeat(80), 10);
    assert.equal(long.length, 10);
    assert.ok(long.endsWith("…"));
  });

  it("monta o snackbar de sucesso com plural correto", () => {
    assert.equal(importedMessage(12), "Plano importado · 12 dias");
    assert.equal(importedMessage(1), "Plano importado · 1 dia");
    assert.equal(importedMessage(0), "Plano importado · 0 dias");
  });
});

describe("import-preview: plano atual", () => {
  it("sem planilha importada, mostra o estado vazio e o plano de exemplo", () => {
    const copy = currentPlanSummary({ days: PLAN, seeded: true });
    assert.equal(copy.imported, false);
    assert.equal(copy.title, "Nenhuma planilha importada");
    assert.equal(copy.detail, "Plano de exemplo · 04/03 a 07/03 · 4 dias");
    assert.equal(copy.dayCount, 4);
  });

  it("planilha importada mostra nome, período e dias", () => {
    const copy = currentPlanSummary({ days: PLAN, seeded: false, sheetName: "Plano ENEM" });
    assert.equal(copy.imported, true);
    assert.equal(copy.title, "Plano ENEM");
    assert.equal(copy.detail, "04/03 a 07/03 · 4 dias");
  });

  it("importação antiga sem nome gravado usa um rótulo neutro", () => {
    const copy = currentPlanSummary({ days: PLAN, seeded: false, sheetName: "  " });
    assert.equal(copy.title, "Planilha importada");
  });

  it("nome gravado vence a flag seeded antiga", () => {
    const copy = currentPlanSummary({ days: PLAN, seeded: true, sheetName: "Plano ENEM" });
    assert.equal(copy.imported, true);
    assert.equal(copy.title, "Plano ENEM");
    assert.equal(copy.detail, "04/03 a 07/03 · 4 dias");
  });

  it("sem nenhum dia não inventa período", () => {
    const copy = currentPlanSummary({ days: [], seeded: false });
    assert.equal(copy.imported, false);
    assert.equal(copy.detail, "Nenhum dia no plano ainda.");
    assert.equal(copy.dayCount, 0);
  });
});
