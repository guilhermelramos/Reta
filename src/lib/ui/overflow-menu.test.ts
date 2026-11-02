import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MENU_GAP, menuSideOffset } from "./overflow-menu.ts";

describe("menu de overflow da tela Hoje", () => {
  it("usa só a folga quando o cabeçalho termina acima do botão", () => {
    assert.equal(menuSideOffset(67, 60), MENU_GAP);
    assert.equal(menuSideOffset(67, 67), MENU_GAP);
  });

  it("desce o menu até a base do bloco de texto quando o H1 passa do botão", () => {
    assert.equal(menuSideOffset(67, 148), 89);
    assert.equal(menuSideOffset(67, 148.2), 90);
  });

  it("nunca deixa o menu encostar no título", () => {
    for (const bottom of [68, 80, 120, 200]) {
      const offset = menuSideOffset(67, bottom);
      assert.ok(offset >= MENU_GAP);
      assert.ok(67 + offset >= bottom + MENU_GAP);
    }
  });

  it("cai na folga padrão quando a medição não é um número", () => {
    assert.equal(menuSideOffset(Number.NaN, 120), MENU_GAP);
    assert.equal(menuSideOffset(67, Number.POSITIVE_INFINITY), MENU_GAP);
  });
});
