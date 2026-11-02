import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideBackAction,
  isEditableTarget,
  isHomePath,
  type BackState,
} from "./back-navigation.ts";

function state(overrides: Partial<BackState> = {}): BackState {
  return { keyboardOpen: false, overlayOpen: false, canGoBack: false, pathname: "/", ...overrides };
}

describe("isHomePath", () => {
  it("reconhece a raiz do app e o shell estático", () => {
    assert.equal(isHomePath("/"), true);
    assert.equal(isHomePath(""), true);
    assert.equal(isHomePath("/index.html"), true);
    assert.equal(isHomePath("/index.htm"), true);
  });

  it("ignora barra final, query e hash", () => {
    assert.equal(isHomePath("/?x=1"), true);
    assert.equal(isHomePath("/#conteudo"), true);
    assert.equal(isHomePath("/index.html?install=1"), true);
  });

  it("não confunde outras rotas com Hoje", () => {
    assert.equal(isHomePath("/plano"), false);
    assert.equal(isHomePath("/plano/"), false);
    assert.equal(isHomePath("/sessao"), false);
    assert.equal(isHomePath("/indexado"), false);
  });
});

describe("isEditableTarget", () => {
  it("reconhece os campos que abrem o teclado", () => {
    assert.equal(isEditableTarget({ tagName: "INPUT", type: "text" }), true);
    assert.equal(isEditableTarget({ tagName: "input", type: "search" }), true);
    assert.equal(isEditableTarget({ tagName: "INPUT", type: "email" }), true);
    assert.equal(isEditableTarget({ tagName: "INPUT", type: "number" }), true);
    assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
    assert.equal(isEditableTarget({ tagName: "TEXTAREA" }), true);
    assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
  });

  it("ignora controles que não abrem teclado de texto", () => {
    assert.equal(isEditableTarget(null), false);
    assert.equal(isEditableTarget({ tagName: "BUTTON" }), false);
    assert.equal(isEditableTarget({ tagName: "INPUT", type: "checkbox" }), false);
    assert.equal(isEditableTarget({ tagName: "INPUT", type: "date" }), false);
    assert.equal(isEditableTarget({ tagName: "SELECT" }), false);
    assert.equal(isEditableTarget({ tagName: "TEXTAREA", readOnly: true }), false);
    assert.equal(isEditableTarget({ tagName: "INPUT", type: "text", disabled: true }), false);
  });
});

describe("decideBackAction", () => {
  it("com o teclado aberto, o primeiro voltar só tira o foco do campo", () => {
    assert.equal(decideBackAction(state({ keyboardOpen: true })), "blur-field");
    assert.equal(
      decideBackAction(state({ keyboardOpen: true, overlayOpen: true, canGoBack: true })),
      "blur-field",
    );
  });

  it("fecha o overlay mais recente, mesmo com histórico e em Hoje", () => {
    assert.equal(decideBackAction(state({ overlayOpen: true })), "close-overlay");
    assert.equal(decideBackAction(state({ overlayOpen: true, canGoBack: true })), "close-overlay");
    assert.equal(decideBackAction(state({ overlayOpen: true, pathname: "/sessao" })), "close-overlay");
  });

  it("volta no histórico quando não há overlay", () => {
    assert.equal(decideBackAction(state({ canGoBack: true, pathname: "/sessao" })), "history-back");
    assert.equal(decideBackAction(state({ canGoBack: true, pathname: "/" })), "history-back");
  });

  it("minimiza em Hoje quando não há histórico (não fecha o app)", () => {
    assert.equal(decideBackAction(state()), "minimize");
    assert.equal(decideBackAction(state({ pathname: "" })), "minimize");
    assert.equal(decideBackAction(state({ pathname: "/index.html" })), "minimize");
  });

  it("leva para Hoje quando uma rota secundária foi aberta sem histórico", () => {
    assert.equal(decideBackAction(state({ pathname: "/plano" })), "navigate-home");
    assert.equal(decideBackAction(state({ pathname: "/sessao" })), "navigate-home");
    assert.equal(decideBackAction(state({ pathname: "/ajustes" })), "navigate-home");
  });
});
