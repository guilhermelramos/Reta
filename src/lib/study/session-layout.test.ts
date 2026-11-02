import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  materialPlaceholderVisible,
  professorPlacement,
  type ProfessorPlacement,
} from "./session-layout.ts";

describe("sessão: cartão de material vazio", () => {
  it("aparece quando o bloco tem minutos e nenhum pacote salvo", () => {
    assert.equal(
      materialPlaceholderVisible({ hasPackage: false, rich: false, plannedMin: 30 }),
      true,
    );
  });

  it("aparece sem plano (bloco sem minutos) e sem pacote", () => {
    assert.equal(
      materialPlaceholderVisible({ hasPackage: false, rich: false, plannedMin: 0 }),
      true,
    );
  });

  it("aparece com pacote incompleto e minutos planejados", () => {
    assert.equal(
      materialPlaceholderVisible({ hasPackage: true, rich: false, plannedMin: 30 }),
      true,
    );
  });

  it("some com pacote rico, mesmo que o plano tenha minutos", () => {
    assert.equal(
      materialPlaceholderVisible({ hasPackage: true, rich: true, plannedMin: 30 }),
      false,
    );
    assert.equal(
      materialPlaceholderVisible({ hasPackage: true, rich: true, plannedMin: 0 }),
      false,
    );
  });

  it("some com pacote incompleto e bloco de 0 min (revisão sem plano)", () => {
    assert.equal(
      materialPlaceholderVisible({ hasPackage: true, rich: false, plannedMin: 0 }),
      false,
    );
  });
});

describe("sessão: posição do botão Professor", () => {
  it("usa o fluxo abaixo do cartão enquanto o material vazio está visível", () => {
    assert.equal(professorPlacement(true), "inline");
  });

  it("volta a flutuar quando o cartão vazio sai da tela", () => {
    assert.equal(professorPlacement(false), "fab");
  });

  it("só devolve as duas posições previstas", () => {
    const placements: ProfessorPlacement[] = [professorPlacement(true), professorPlacement(false)];
    assert.deepEqual(placements, ["inline", "fab"]);
  });
});
