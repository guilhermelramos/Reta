import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDayFromDraft, dayDraftFromDay, newDayDraft } from "./plan-draft.ts";
import type { DayDraft } from "./plan-draft.ts";
import type { PlanDay } from "./types.ts";

function draft(overrides: Partial<DayDraft> = {}): DayDraft {
  return {
    mode: "new",
    date: "2026-11-10",
    phase: "Semana 1",
    blocks: [
      { key: "a", kind: "A", content: "  Matemática:  PA  ", minutes: "1h30" },
      { key: "b", kind: "B", content: "", minutes: "" },
    ],
    ...overrides,
  };
}

describe("buildDayFromDraft: validação do formulário", () => {
  it("normaliza tópico, fase e minutos", () => {
    const result = buildDayFromDraft(draft());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.day, {
      date: "2026-11-10",
      phase: "Semana 1",
      blocks: [{ kind: "A", content: "Matemática: PA", plannedMin: 90 }],
    });
  });

  it("bloco sem tópico não é salvo e minutos vazios viram zero", () => {
    const result = buildDayFromDraft(
      draft({
        blocks: [{ key: "a", kind: "R", content: "Revisão de física", minutes: "" }],
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.day.blocks[0]!.plannedMin, 0);
  });

  it("recusa data inválida", () => {
    const result = buildDayFromDraft(draft({ date: "10/11/2026" }));
    assert.deepEqual(result, { ok: false, error: "Escolha uma data válida." });
  });

  it("recusa minutos ilegíveis", () => {
    const result = buildDayFromDraft(
      draft({ blocks: [{ key: "a", kind: "A", content: "PA", minutes: "muito" }] }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /Minutos de Bloco A inválidos/);
  });

  it("recusa o mesmo bloco duas vezes", () => {
    const result = buildDayFromDraft(
      draft({
        blocks: [
          { key: "a", kind: "A", content: "PA", minutes: "45" },
          { key: "b", kind: "A", content: "PG", minutes: "30" },
        ],
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /Bloco A está repetido/);
  });

  it("recusa dia sem nenhum tópico", () => {
    const result = buildDayFromDraft(
      draft({ blocks: [{ key: "a", kind: "A", content: "  ", minutes: "45" }] }),
    );
    assert.deepEqual(result, {
      ok: false,
      error: "Preencha o tópico de pelo menos um bloco.",
    });
  });
});

describe("dayDraftFromDay: edição de um dia existente", () => {
  it("leva minutos planejados como texto e mantém o tipo", () => {
    const day: PlanDay = {
      date: "2026-11-10",
      phase: "Semana 1",
      blocks: [
        { kind: "A", content: "PA", plannedMin: 90 },
        { kind: "B", content: "Física", plannedMin: 0 },
      ],
    };
    const edit = dayDraftFromDay(day);
    assert.equal(edit.mode, "edit");
    assert.equal(edit.date, day.date);
    assert.deepEqual(
      edit.blocks.map((block) => [block.kind, block.content, block.minutes]),
      [
        ["A", "PA", "90"],
        ["B", "Física", ""],
      ],
    );
  });

  it("dia vazio abre com um bloco A", () => {
    const edit = dayDraftFromDay({ date: "2026-11-10", phase: "", blocks: [] });
    assert.equal(edit.blocks.length, 1);
    assert.equal(edit.blocks[0]!.kind, "A");
  });
});

describe("newDayDraft: dia novo", () => {
  it("começa com Data, Bloco A e Bloco B", () => {
    const created = newDayDraft("2026-11-12");
    assert.equal(created.mode, "new");
    assert.equal(created.date, "2026-11-12");
    assert.deepEqual(
      created.blocks.map((block) => block.kind),
      ["A", "B"],
    );
    assert.equal(created.blocks[0]!.minutes, "60");
  });
});
