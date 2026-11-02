import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  notebookChipLabel,
  professorChips,
  QUICK_QUESTIONS,
  SHORTCUTS,
} from "./professor-chips.ts";

describe("professor: linha única de chips", () => {
  it("começa pelas perguntas rápidas quando a conversa está vazia", () => {
    const chips = professorChips(0);
    const quick = chips.slice(0, QUICK_QUESTIONS.length);
    assert.deepEqual(
      quick.map((chip) => chip.label),
      [...QUICK_QUESTIONS],
    );
    assert.ok(quick.every((chip) => chip.kind === "ask"));
  });

  it("depois da primeira mensagem mantém só os atalhos e as ações", () => {
    const chips = professorChips(2);
    assert.deepEqual(
      chips.map((chip) => chip.label),
      [...SHORTCUTS, "Desenhe isso em SVG", "Me teste nisso"],
    );
  });

  it("as ações locais ficam sempre no fim da linha", () => {
    const chips = professorChips(0);
    assert.deepEqual(
      chips.slice(-2).map((chip) => chip.kind),
      ["draw", "test"],
    );
  });

  it("ids são únicos e rótulos não têm quebra de linha", () => {
    const chips = professorChips(0);
    assert.equal(new Set(chips.map((chip) => chip.id)).size, chips.length);
    for (const chip of chips) {
      assert.equal(chip.label, chip.label.trim());
      assert.equal(/[\r\n]/.test(chip.label), false, `quebrou linha: ${chip.label}`);
      assert.ok(chip.label.length > 0);
    }
  });

  it("contagem inválida se comporta como conversa vazia", () => {
    assert.deepEqual(professorChips(Number.NaN), professorChips(0));
    assert.deepEqual(professorChips(-1), professorChips(0));
  });
});

describe("professor: assist chip do cabeçalho", () => {
  it("mostra o destino do toque", () => {
    assert.equal(notebookChipLabel("chat"), "Caderno");
    assert.equal(notebookChipLabel("caderno"), "Conversa");
  });
});
