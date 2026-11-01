import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBlockPackage } from "./block-package.ts";
import {
  asQuiz,
  coercePackage,
  coerceResearch,
  extractJson,
  imageQueries,
  tutorText,
} from "./parse.ts";

const QUESTIONS = Array.from({ length: 4 }, (_, index) => ({
  prompt: `Questão ${index + 1} com enunciado suficientemente longo.`,
  choices: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
  correctIndex: index % 4,
  hint: "Pense no conceito principal.",
  explanation: "Explicação longa o bastante para o validador aceitar.",
  altExplanation: "Outro caminho de resolução.",
  diagramSvg: "",
}));

function packageJson(overrides: Record<string, unknown> = {}) {
  return {
    essence: ["Primeira ideia.", "Segunda ideia.", "Terceira ideia."],
    development: "Desenvolvimento do tema.",
    concepts: [
      { term: "Conceito A", symbol: "A", meaning: "Significado do conceito A." },
      { term: "Conceito B", symbol: "", meaning: "Significado do conceito B." },
    ],
    formulas: [],
    pitfalls: ["Não confunda A com B."],
    sources: [{ title: "Fonte", url: "https://exemplo.org", note: "Nota" }],
    imageQueries: ["brasil mapa", "revolução"],
    diagramSvg: "",
    diagnostic: QUESTIONS[0],
    questions: QUESTIONS,
    flashcards: [{ front: "Frente", back: "Verso" }],
    ...overrides,
  };
}

describe("extractJson", () => {
  it("lê JSON puro, com cerca de markdown e com texto em volta", () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
    assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(extractJson('Segue a resposta:\n{"a":1}\nFim.'), { a: 1 });
  });

  it("falha com mensagem clara quando não há JSON", () => {
    assert.throws(() => extractJson("sem json aqui"), /não veio em JSON/);
    assert.throws(() => extractJson("{quebrado"), /não veio em JSON/);
  });
});

describe("asQuiz", () => {
  it("normaliza questão válida", () => {
    const quiz = asQuiz(QUESTIONS[0], "medio", "q1");
    assert.ok(quiz);
    assert.equal(quiz.id, "q1");
    assert.equal(quiz.choices.length, 4);
    assert.equal(quiz.correctIndex, 0);
  });

  it("rejeita alternativa faltando ou índice inválido", () => {
    assert.equal(asQuiz({ ...QUESTIONS[0], choices: ["A", "B", "C"] }, "facil", "q1"), null);
    assert.equal(asQuiz({ ...QUESTIONS[0], correctIndex: 9 }, "facil", "q1"), null);
    assert.equal(asQuiz({ ...QUESTIONS[0], prompt: "" }, "facil", "q1"), null);
  });

  it("remove script do SVG da questão", () => {
    const quiz = asQuiz(
      {
        ...QUESTIONS[0],
        diagramSvg:
          '<svg viewBox="0 0 10 10"><script>alert(1)</script><circle cx="5" cy="5" r="2"/></svg>',
      },
      "facil",
      "q1",
    );
    assert.ok(quiz);
    assert.ok(quiz.diagramSvg.includes("<circle"));
    assert.doesNotMatch(quiz.diagramSvg, /script|alert/i);
  });
});

describe("coercePackage", () => {
  it("aceita pacote completo e preserva o provedor", () => {
    const pack = coercePackage(packageJson(), "grok", false);
    assert.ok(pack);
    assert.equal(pack.provider, "grok");
    assert.equal(pack.questions.length, 4);
    assert.equal(pack.diagnostic.id, "diag");
    assert.equal(pack.sources[0]?.url, "https://exemplo.org");
  });

  it("rejeita pacote sem questões suficientes", () => {
    assert.equal(coercePackage(packageJson({ questions: [QUESTIONS[0]] }), "grok", false), null);
  });

  it("rejeita conceitos de menos", () => {
    assert.equal(
      coercePackage(packageJson({ concepts: [packageJson().concepts[0]] }), "grok", false),
      null,
    );
  });

  it("mantém só SVG válido e sem script", () => {
    const valid =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><g data-role="node" data-id="a"><rect x="0" y="0" width="40" height="20" fill="none"/><text x="20" y="10" font-size="10" text-anchor="middle">A</text></g></svg>';
    const pack = coercePackage(packageJson({ diagramSvg: valid }), "grok", false);
    assert.ok(pack);
    assert.ok(pack.diagramSvg.includes("<svg"));

    const dirty = valid.replace("<g ", "<script>alert(1)</script><g ");
    const clean = coercePackage(packageJson({ diagramSvg: dirty }), "grok", false);
    assert.ok(clean);
    assert.doesNotMatch(clean.diagramSvg, /script|alert/i);
  });
});

describe("coerceResearch", () => {
  const raw = {
    title: "Fora do pacote",
    paragraphs: [
      "Primeiro parágrafo com explicação longa o suficiente para passar do limite mínimo.",
      "curto",
    ],
    concepts: [
      {
        term: "Termo",
        symbol: "",
        meaning: "Significado com mais de quarenta caracteres para ser aceito.",
      },
    ],
    sources: [
      { title: "Fonte", url: "javascript:alert(1)", note: "Nota" },
      { title: "Outra", url: "https://exemplo.org", note: "Nota" },
    ],
  };

  it("mantém parágrafos úteis e descarta URL não http", () => {
    const research = coerceResearch(raw);
    assert.ok(research);
    assert.equal(research.paragraphs.length, 1);
    assert.equal(research.concepts.length, 1);
    assert.equal(research.sources[0]?.url, "");
    assert.equal(research.sources[1]?.url, "https://exemplo.org");
  });

  it("devolve null sem parágrafo utilizável", () => {
    assert.equal(coerceResearch({ ...raw, paragraphs: ["curto"] }), null);
  });
});

describe("parseBlockPackage", () => {
  const summary =
    "Resumo de prova com mais de quarenta caracteres. Ele explica o conceito central e a pegadinha clássica do vestibular.";
  const cards = Array.from({ length: 5 }, (_, index) => ({
    front: `Frente ${index}`,
    back: `Verso ${index}`,
  }));
  const questions = Array.from({ length: 4 }, (_, index) => ({
    prompt: `Questão ${index + 1} contextualizada e suficientemente longa.`,
    explanation: "Explicação com o motivo da correta e o erro dos distratores.",
    options: { A: "A", B: "B", C: "C", D: "D", E: "E" },
    correctOption: "A",
    hint: "Pista sem gabarito.",
    difficulty: index === 0 ? "facil" : index === 3 ? "dificil" : "medio",
  }));

  const valid = {
    title: "Funções",
    summary,
    essence: ["Ideia um.", "Ideia dois.", "Ideia três."],
    concepts: [
      { term: "Domínio", symbol: "", meaning: "Valores de entrada da função." },
      { term: "Imagem", symbol: "", meaning: "Valores de saída da função." },
    ],
    formulas: [{ expr: "f(x)=ax+b", meaning: "Função afim" }],
    pitfalls: ["Trocar domínio por imagem é o erro clássico."],
    flashcards: cards,
    questions,
  };

  it("valida o JSON do modelo e adapta as 5 alternativas", () => {
    const parsed = parseBlockPackage(JSON.stringify(valid));
    assert.ok(parsed);
    assert.equal(parsed.title, "Funções");
    assert.equal(parsed.flashcards.length, 5);
    assert.equal(parsed.questions.length, 4);
    assert.equal(parsed.questions[0]?.choices.length, 5);
    assert.equal(parsed.questions[0]?.correctIndex, 0);
    assert.equal(parsed.questions[3]?.difficulty, "dificil");
  });

  it("aceita JSON cercado por markdown", () => {
    const parsed = parseBlockPackage(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``);
    assert.ok(parsed);
  });

  it("rejeita questão com 4 alternativas ou flashcards faltando", () => {
    const four = {
      ...valid,
      questions: valid.questions.map((question) => ({
        ...question,
        options: { A: "A", B: "B", C: "C", D: "D" },
      })),
    };
    assert.equal(parseBlockPackage(JSON.stringify(four)), null);
    assert.equal(
      parseBlockPackage(JSON.stringify({ ...valid, flashcards: cards.slice(0, 4) })),
      null,
    );
  });
});

describe("helpers de imagem e tutor", () => {
  it("limita as buscas de imagem a dois termos", () => {
    assert.deepEqual(imageQueries({ imageQueries: ["um", "dois", "três"] }), ["um", "dois"]);
    assert.deepEqual(imageQueries({}), []);
  });

  it("recorta o texto do tutor", () => {
    assert.equal(tutorText({ text: "  Outra explicação.  " }), "Outra explicação.");
    assert.equal(tutorText({ text: 42 }), "");
  });
});
