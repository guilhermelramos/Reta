import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { restorePlan, snapshotPlan } from "./import-undo.ts";
import type { PlanDay } from "./types.ts";

function plan(): PlanDay[] {
  return [
    {
      date: "2026-03-04",
      phase: "Semana 1",
      blocks: [
        { kind: "A", content: "Funções", plannedMin: 50 },
        { kind: "R", content: "Revisão", plannedMin: 20 },
      ],
    },
    {
      date: "2026-03-05",
      phase: "",
      blocks: [{ kind: "B", content: "Logaritmos", plannedMin: 40 }],
    },
  ];
}

describe("import-undo: snapshot do plano anterior", () => {
  it("guarda plano, nome da planilha e a flag seeded", () => {
    const undo = snapshotPlan({ days: plan(), sheetName: "Plano ENEM", seeded: false });
    assert.equal(undo.sheetName, "Plano ENEM");
    assert.equal(undo.seeded, false);
    assert.deepEqual(
      undo.days.map((day) => day.date),
      ["2026-03-04", "2026-03-05"],
    );
    assert.equal(undo.days[0]?.blocks.length, 2);
  });

  it("não muda quando a lista original é alterada depois", () => {
    const original = plan();
    const undo = snapshotPlan({ days: original, sheetName: "", seeded: true });
    original[0]!.blocks[0]!.content = "alterado";
    original.push({ date: "2026-03-06", phase: "", blocks: [] });
    assert.equal(undo.days.length, 2);
    assert.equal(undo.days[0]?.blocks[0]?.content, "Funções");
    assert.equal(undo.seeded, true);
  });

  it("restaura uma cópia independente do snapshot guardado", () => {
    const undo = snapshotPlan({ days: plan(), sheetName: "Plano ENEM", seeded: false });
    const restored = restorePlan(undo);
    restored.days[0]!.blocks[0]!.content = "outro";
    assert.equal(undo.days[0]?.blocks[0]?.content, "Funções");
    assert.equal(restored.sheetName, "Plano ENEM");
    assert.equal(restored.seeded, false);
  });

  it("não carrega sessões, pacotes ou erros", () => {
    const undo = snapshotPlan({ days: plan(), sheetName: "Plano ENEM", seeded: false });
    assert.deepEqual(Object.keys(undo).sort(), ["days", "seeded", "sheetName"]);
  });
});
