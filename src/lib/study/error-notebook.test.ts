import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearNotebookFilters,
  DEFAULT_NOTEBOOK_FILTERS,
  emptyListMessage,
  filterMistakes,
  hasActiveFilters,
  isNotebookEmpty,
  mistakeSourceLabel,
  mistakeSubject,
  mistakeSubtopic,
  nextReviewCardLabel,
  nextReviewDate,
  nextReviewLabel,
  notebookCounts,
  notebookList,
  notebookReasons,
  notebookSubjects,
  notebookSummary,
  outcomeIntervalLabel,
  reviewProgressLabel,
  reviewProgressPercent,
  sortMistakes,
  validateMistakePrompt,
  EMPTY_MISTAKE_PROMPT,
} from "./error-notebook.ts";
import { formatShortDate } from "./time.ts";
import type { ErrorReason, Mistake } from "./types.ts";

const TODAY = "2026-11-02";

function mistake(overrides: Partial<Mistake> & { id: string }): Mistake {
  return {
    sessionId: "sessao-1",
    date: "2026-11-01",
    kind: "A",
    topic: "Funções afim",
    prompt: "Qual é o coeficiente angular?",
    choices: [],
    correctIndex: -1,
    userIndex: -1,
    explanation: "",
    createdAt: 1,
    reviewed: false,
    srsStage: 0,
    reviewCount: 0,
    ...overrides,
  };
}

const DUE_TODAY = mistake({ id: "due-hoje", nextReviewAt: TODAY, createdAt: 10 });
const DUE_LEGACY = mistake({ id: "due-legado", nextReviewAt: undefined, createdAt: 20 });
const FUTURE = mistake({
  id: "futuro",
  nextReviewAt: "2026-11-05",
  srsStage: 1,
  createdAt: 30,
});
const MASTERED_REVIEWED = mistake({ id: "dominado-revisado", reviewed: true, createdAt: 40 });
const MASTERED_STAGE = mistake({
  id: "dominado-estagio",
  srsStage: 5,
  nextReviewAt: "2026-12-01",
  createdAt: 50,
});
const ALL = [DUE_TODAY, DUE_LEGACY, FUTURE, MASTERED_REVIEWED, MASTERED_STAGE];

describe("notebookCounts: contagem do topo", () => {
  it("separa vencidos, pendentes, dominados e total", () => {
    const counts = notebookCounts(ALL, TODAY);
    assert.deepEqual(counts, { due: 2, pending: 3, mastered: 2, total: 5 });
    assert.equal(notebookSummary(counts), "2 para revisar hoje · 5 no total");
  });

  it("caderno vazio zera tudo", () => {
    assert.deepEqual(notebookCounts([], TODAY), {
      due: 0,
      pending: 0,
      mastered: 0,
      total: 0,
    });
  });

  it("erro sem nextReviewAt continua vencido (registro antigo)", () => {
    const counts = notebookCounts([DUE_LEGACY], TODAY);
    assert.equal(counts.due, 1);
    assert.equal(counts.pending, 1);
  });
});

describe("nextReviewDate: próxima data futura", () => {
  it("escolhe a menor data futura entre os pendentes", () => {
    assert.equal(nextReviewDate(ALL, TODAY), "2026-11-05");
  });

  it("ignora dominados e datas de hoje/atrasadas", () => {
    assert.equal(nextReviewDate([DUE_TODAY, MASTERED_STAGE], TODAY), null);
  });

  it("rotula amanhã e a data curta", () => {
    assert.equal(nextReviewLabel("2026-11-03", TODAY), "Próxima revisão amanhã");
    assert.equal(
      nextReviewLabel("2026-11-05", TODAY),
      `Próxima revisão em ${formatShortDate("2026-11-05")}`,
    );
    assert.equal(nextReviewLabel(null, TODAY), "");
  });
});

describe("mistakeSubject: matéria usada no título e no filtro", () => {
  it("prefere o campo subject do erro externo", () => {
    assert.equal(mistakeSubject({ subject: "Biologia", topic: "Biologia · Genética" }), "Biologia");
  });

  it("usa o tópico do bloco quando não há matéria", () => {
    assert.equal(mistakeSubject({ topic: "Funções afim" }), "Funções afim");
    assert.equal(mistakeSubject({ topic: "Matemática · Logaritmos" }), "Matemática");
  });

  it("tem um rótulo seguro para registros sem tópico", () => {
    assert.equal(mistakeSubject({ topic: "  " }), "Sem matéria");
  });
});

describe("mistakeSourceLabel: origem no detalhe e na revisão", () => {
  it("mostra a matéria na revisão e a omite quando o título já a mostra", () => {
    const externo = { source: "externo" as const, subject: "Biologia", kind: "A" as const };
    assert.equal(mistakeSourceLabel(externo), "Externo · Biologia");
    assert.equal(mistakeSourceLabel(externo, false), "Externo");
    assert.equal(mistakeSourceLabel({ source: "sessao" as const, kind: "B" as const }), "Bloco B");
  });
});

describe("mistakeSubtopic: detalhe sem repetir o título", () => {
  it("tira a matéria já usada no título", () => {
    assert.equal(
      mistakeSubtopic({ subject: "Biologia", topic: "Biologia · Genética" }),
      "Genética",
    );
  });

  it("não repete um tópico igual ao título", () => {
    assert.equal(mistakeSubtopic({ topic: "Funções afim" }), "");
    assert.equal(mistakeSubtopic({ subject: "Biologia", topic: "Biologia" }), "");
  });

  it("mantém um tópico diferente da matéria", () => {
    assert.equal(mistakeSubtopic({ subject: "Biologia", topic: "Genética" }), "Genética");
  });
});

describe("filterMistakes: status, matéria e motivo", () => {
  it("pendentes incluem os vencidos", () => {
    const list = filterMistakes(ALL, DEFAULT_NOTEBOOK_FILTERS, TODAY);
    assert.deepEqual(list.map((item) => item.id).sort(), ["due-hoje", "due-legado", "futuro"]);
  });

  it("vencidos são só os que já chegaram na data", () => {
    const list = filterMistakes(ALL, { ...DEFAULT_NOTEBOOK_FILTERS, status: "vencidos" }, TODAY);
    assert.deepEqual(list.map((item) => item.id).sort(), ["due-hoje", "due-legado"]);
  });

  it("dominados são os revisados ou com estágio máximo", () => {
    const list = filterMistakes(ALL, { ...DEFAULT_NOTEBOOK_FILTERS, status: "dominados" }, TODAY);
    assert.deepEqual(list.map((item) => item.id).sort(), ["dominado-estagio", "dominado-revisado"]);
  });

  it("combina matéria e motivo sem alterar a lista original", () => {
    const externo = mistake({
      id: "externo",
      source: "externo",
      subject: "Biologia",
      topic: "Biologia · Genética",
      errorReason: "lacuna_teorica" as ErrorReason,
      nextReviewAt: TODAY,
    });
    const list = filterMistakes(
      [externo, ...ALL],
      { subject: "Biologia", reason: "lacuna_teorica", status: "pendentes" },
      TODAY,
    );
    assert.deepEqual(
      list.map((item) => item.id),
      ["externo"],
    );
    assert.equal(ALL.length, 5);
  });

  it("motivo sem correspondência zera a lista", () => {
    const list = filterMistakes(ALL, { ...DEFAULT_NOTEBOOK_FILTERS, reason: "tempo" }, TODAY);
    assert.deepEqual(list, []);
  });
});

describe("sortMistakes: ordem de revisão", () => {
  it("data mais próxima primeiro e, no empate, o mais recente", () => {
    const a = mistake({ id: "a", nextReviewAt: "2026-11-05", createdAt: 1 });
    const b = mistake({ id: "b", nextReviewAt: "2026-11-02", createdAt: 2 });
    const c = mistake({ id: "c", nextReviewAt: "2026-11-02", createdAt: 3 });
    assert.deepEqual(
      sortMistakes([a, b, c]).map((item) => item.id),
      ["c", "b", "a"],
    );
  });

  it("registros sem data vêm antes (estão vencidos)", () => {
    const semData = mistake({ id: "sem-data", createdAt: 1 });
    const futuro = mistake({ id: "futuro", nextReviewAt: "2026-12-01", createdAt: 9 });
    assert.deepEqual(
      notebookList([futuro, semData], DEFAULT_NOTEBOOK_FILTERS, TODAY).map((item) => item.id),
      ["sem-data", "futuro"],
    );
  });
});

describe("opções dos chips", () => {
  it("lista matérias únicas em ordem alfabética", () => {
    const items = [
      mistake({ id: "1", subject: "Química", topic: "Química · Orgânica" }),
      mistake({ id: "2", topic: "Biologia" }),
      mistake({ id: "3", topic: "Biologia" }),
    ];
    assert.deepEqual(notebookSubjects(items), ["Biologia", "Química"]);
  });

  it("lista só os motivos presentes, na ordem fixa", () => {
    const items = [
      mistake({ id: "1", errorReason: "tempo" }),
      mistake({ id: "2", errorReason: "lacuna_teorica" }),
      mistake({ id: "3" }),
    ];
    assert.deepEqual(notebookReasons(items), ["lacuna_teorica", "tempo"]);
  });
});

describe("filtros ativos", () => {
  it("o padrão não conta como filtro ativo", () => {
    assert.equal(hasActiveFilters(DEFAULT_NOTEBOOK_FILTERS), false);
  });

  it("matéria, motivo ou status fora do padrão ativam o Limpar", () => {
    assert.equal(hasActiveFilters({ ...DEFAULT_NOTEBOOK_FILTERS, subject: "Biologia" }), true);
    assert.equal(hasActiveFilters({ ...DEFAULT_NOTEBOOK_FILTERS, reason: "tempo" }), true);
    assert.equal(hasActiveFilters({ ...DEFAULT_NOTEBOOK_FILTERS, status: "vencidos" }), true);
  });

  it("limpar devolve uma cópia do padrão", () => {
    const cleared = clearNotebookFilters();
    assert.deepEqual(cleared, DEFAULT_NOTEBOOK_FILTERS);
    assert.notEqual(cleared, DEFAULT_NOTEBOOK_FILTERS);
  });
});

describe("nextReviewCardLabel: rodapé do cartão", () => {
  it("hoje, data futura e dominado", () => {
    assert.equal(nextReviewCardLabel(DUE_TODAY, TODAY), "Revisar hoje");
    assert.equal(
      nextReviewCardLabel(FUTURE, TODAY),
      `Próxima revisão ${formatShortDate("2026-11-05")}`,
    );
    assert.equal(nextReviewCardLabel(MASTERED_STAGE, TODAY), "Dominado");
  });
});

describe("progresso da revisão", () => {
  it("mostra k de N a partir de 1", () => {
    assert.equal(reviewProgressLabel(0, 3), "1 de 3");
    assert.equal(reviewProgressLabel(2, 3), "3 de 3");
    assert.equal(reviewProgressLabel(0, 0), "0 de 0");
  });

  it("não passa do total nem cai abaixo de 1", () => {
    assert.equal(reviewProgressLabel(9, 3), "3 de 3");
    assert.equal(reviewProgressLabel(-2, 3), "1 de 3");
    assert.equal(reviewProgressPercent(0, 3), 33);
    assert.equal(reviewProgressPercent(2, 3), 100);
    assert.equal(reviewProgressPercent(0, 0), 0);
  });
});

describe("outcomeIntervalLabel: intervalo do resultado", () => {
  it("errei e difícil têm intervalos fixos", () => {
    assert.equal(outcomeIntervalLabel("errei"), "+1 dia");
    assert.equal(outcomeIntervalLabel("dificil"), "+3 dias");
  });

  it("fácil cresce com o estágio", () => {
    assert.equal(outcomeIntervalLabel("facil", 0), "+7 dias");
    assert.equal(outcomeIntervalLabel("facil", 2), "+15 dias");
    assert.equal(outcomeIntervalLabel("facil", 4), "+30 dias");
  });
});

describe("isNotebookEmpty: ações dentro do cartão vazio", () => {
  it("só é vazio sem nenhum erro guardado", () => {
    assert.equal(isNotebookEmpty({ total: 0 }), true);
    assert.equal(isNotebookEmpty({ total: 1 }), false);
  });
});

describe("mensagens vazias e validação", () => {
  it("com filtro ativo fala dos filtros", () => {
    assert.equal(emptyListMessage("pendentes", true), "Nenhum erro com estes filtros.");
  });

  it("sem filtro fala do status escolhido", () => {
    assert.match(emptyListMessage("dominados", false), /dominado/i);
    assert.match(emptyListMessage("pendentes", false), /pendente/i);
    assert.match(emptyListMessage("vencidos", false), /data da revisão/i);
  });

  it("só o resumo da questão é obrigatório", () => {
    assert.equal(validateMistakePrompt("  "), EMPTY_MISTAKE_PROMPT);
    assert.equal(validateMistakePrompt("  O que a questão pedia  "), null);
  });
});
