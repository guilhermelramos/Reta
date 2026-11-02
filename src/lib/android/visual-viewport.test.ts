import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keyboardInset, visibleHeight } from "./visual-viewport.ts";

describe("medidas da visualViewport", () => {
  it("sem teclado não há faixa coberta", () => {
    assert.equal(keyboardInset({ layoutHeight: 800, visualHeight: 800, visualOffsetTop: 0 }), 0);
  });

  it("com adjustResize a janela encolhe junto e a faixa continua zero", () => {
    // O WebView já reduziu innerHeight e visualViewport para a área visível.
    assert.equal(keyboardInset({ layoutHeight: 480, visualHeight: 480, visualOffsetTop: 0 }), 0);
  });

  it("quando só a visualViewport encolhe, devolve o espaço do teclado", () => {
    assert.equal(keyboardInset({ layoutHeight: 800, visualHeight: 480, visualOffsetTop: 0 }), 320);
  });

  it("considera o deslocamento do topo (visualViewport rolada)", () => {
    assert.equal(keyboardInset({ layoutHeight: 800, visualHeight: 500, visualOffsetTop: 100 }), 200);
  });

  it("nunca devolve faixa negativa", () => {
    assert.equal(keyboardInset({ layoutHeight: 400, visualHeight: 900, visualOffsetTop: 0 }), 0);
    assert.equal(keyboardInset({ layoutHeight: -10, visualHeight: 0, visualOffsetTop: 50 }), 0);
  });

  it("altura visível é arredondada e não fica negativa", () => {
    assert.equal(visibleHeight({ layoutHeight: 800, visualHeight: 479.6, visualOffsetTop: 0 }), 480);
    assert.equal(visibleHeight({ layoutHeight: 800, visualHeight: -1, visualOffsetTop: 0 }), 0);
  });
});
