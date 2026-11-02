import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHeatmap,
  EMPTY_PROGRESS_MESSAGE,
  emptyProgressCopy,
  examCountdown,
  firstFoldMetrics,
  formatHoursCompact,
  hasQuestionDiagnostics,
  heatmapLevel,
  isEmptyProgress,
  planDayRows,
  planVsReal,
  reasonRows,
  totalAnsweredQuestions,
  totalStudiedSeconds,
  weakTopics,
  weekEnd,
  weekProgress,
  weekStart,
} from "./progress-dashboard.ts";
import { currentStreak } from "./progress-metrics.ts";
import type { BlockKind, Mistake, PlanBlock, PlanDay, StudySession } from "./types.ts";

const TODAY = "2026-11-01";

function block(kind: BlockKind, plannedMin: number, content = `${kind} · conteúdo`): PlanBlock {
  return { kind, content, plannedMin };
}

function day(date: string, blocks: PlanBlock[], phase = ""): PlanDay {
  return { date, phase, blocks };
}

function session(
  overrides: Partial<StudySession> & Pick<StudySession, "kind" | "status">,
): StudySession {
  return {
    id: `session-${overrides.kind}-${overrides.status}-${overrides.date ?? TODAY}`,
    date: TODAY,
    mode: "cheio",
    sheetMin: 60,
    budgetMin: 60,
    bonusMin: 0,
    elapsedSec: 0,
    running: false,
    runStartedAt: null,
    step: "aula",
    diagCorrect: null,
    asked: [],
    correct: 0,
    wrong: 0,
    difficulty: "facil",
    missed: [],
    startedAt: 0,
    endedAt: null,
    ...overrides,
  };
}

function mistake(overrides: Partial<Mistake> = {}): Mistake {
  return {
    id: `mistake-${Math.random()}`,
    sessionId: "externo",
    date: TODAY,
    kind: "A",
    topic: "Matemática",
    prompt: "Questão",
    choices: [],
    correctIndex: -1,
    userIndex: -1,
    explanation: "",
    createdAt: 0,
    reviewed: false,
    ...overrides,
  };
}

describe("examCountdown: linha do topo", () => {
  it("conta os dias até a prova", () => {
    const days = [day("2026-11-10", []), day("2026-11-20", [], "Prova final")];
    assert.deepEqual(examCountdown(days, "2026-11-10"), {
      daysLeft: 10,
      label: "Faltam 10 dias para a prova",
    });
  });

  it("usa o singular com um dia e trata hoje e o passado", () => {
    assert.equal(
      examCountdown([day("2026-11-20", [], "Prova")], "2026-11-19").label,
      "Falta 1 dia para a prova",
    );
    assert.equal(
      examCountdown([day("2026-11-20", [], "Prova")], "2026-11-20").label,
      "A prova é hoje",
    );
    assert.equal(
      examCountdown([day("2026-11-20", [], "Prova")], "2026-11-21").label,
      "A data da prova já passou",
    );
  });

  it("sem plano não inventa uma data", () => {
    assert.deepEqual(examCountdown([], TODAY), {
      daysLeft: null,
      label: "Sem data de prova no plano",
    });
  });
});

describe("formatHoursCompact: número grande do cartão", () => {
  it("mostra minutos abaixo de uma hora e horas com dois dígitos", () => {
    assert.equal(formatHoursCompact(0), "0min");
    assert.equal(formatHoursCompact(45), "45min");
    assert.equal(formatHoursCompact(60), "1h");
    assert.equal(formatHoursCompact(90), "1h30");
    assert.equal(formatHoursCompact(605), "10h05");
  });

  it("não quebra com valores inválidos", () => {
    assert.equal(formatHoursCompact(Number.NaN), "0min");
    assert.equal(formatHoursCompact(-30), "0min");
  });
});

describe("semana: segunda a domingo", () => {
  it("domingo pertence à semana que começou na segunda", () => {
    assert.equal(weekStart("2026-11-01"), "2026-10-26");
    assert.equal(weekEnd("2026-11-01"), "2026-11-01");
  });

  it("segunda abre a própria semana", () => {
    assert.equal(weekStart("2026-11-02"), "2026-11-02");
    assert.equal(weekEnd("2026-11-02"), "2026-11-08");
  });
});

describe("weekProgress: horas da semana contra o planejado", () => {
  it("soma só a semana de hoje", () => {
    const days = [
      day("2026-10-26", [block("A", 60)]),
      day("2026-10-28", [block("B", 30)]),
      day("2026-11-09", [block("A", 120)]),
    ];
    const sessions = [
      session({ kind: "A", status: "done", date: "2026-10-27", elapsedSec: 1800 }),
      session({ kind: "B", status: "done", date: "2026-10-28", elapsedSec: 600 }),
      session({ kind: "A", status: "done", date: "2026-11-09", elapsedSec: 3600 }),
    ];
    assert.deepEqual(weekProgress(days, sessions, TODAY), {
      start: "2026-10-26",
      end: "2026-11-01",
      studiedMin: 40,
      plannedMin: 90,
      pct: 44,
    });
  });
});

describe("firstFoldMetrics: as três métricas da primeira dobra", () => {
  it("traz sequência, horas da semana e percentual do plano", () => {
    const days = [
      day("2026-10-30", [block("A", 60)]),
      day("2026-10-31", [block("A", 60)]),
      day("2026-11-01", [block("A", 60)], "Prova"),
    ];
    const sessions = days.map((item) =>
      session({ kind: "A", status: "done", date: item.date, elapsedSec: 3600 }),
    );

    const metrics = firstFoldMetrics({ days, sessions, today: TODAY });
    assert.deepEqual(
      metrics.map((metric) => [metric.key, metric.value, metric.label]),
      [
        ["streak", "3", "dias seguidos"],
        ["week", "3h", "de 3h na semana"],
        ["plan", "100%", "do plano concluído"],
      ],
    );
    assert.equal(metrics[0].ariaLabel, "Sequência de 3 dias");
    assert.equal(metrics[1].ariaLabel, "3h estudadas de 3h planejadas nesta semana");
    assert.equal(metrics[2].ariaLabel, "100% do plano concluído");
  });

  it("sem plano mostra travessão no percentual e minutos estudados", () => {
    const metrics = firstFoldMetrics({ days: [], sessions: [], today: TODAY });
    assert.equal(metrics[0].value, "0");
    assert.equal(metrics[1].value, "0min");
    assert.equal(metrics[1].label, "estudadas na semana");
    assert.equal(metrics[2].value, "—");
  });
});

describe("heatmapLevel: escala de intensidade", () => {
  it("separa nada, até 14, 15–29, 30–59 e 60+ minutos", () => {
    assert.equal(heatmapLevel(0), 0);
    assert.equal(heatmapLevel(1), 1);
    assert.equal(heatmapLevel(14), 1);
    assert.equal(heatmapLevel(15), 2);
    assert.equal(heatmapLevel(29), 2);
    assert.equal(heatmapLevel(30), 3);
    assert.equal(heatmapLevel(59), 3);
    assert.equal(heatmapLevel(60), 4);
    assert.equal(heatmapLevel(240), 4);
  });

  it("trata valores inválidos como zero", () => {
    assert.equal(heatmapLevel(Number.NaN), 0);
    assert.equal(heatmapLevel(-10), 0);
  });
});

describe("buildHeatmap: 28 dias alinhados por semana", () => {
  const days = [day("2026-10-20", [block("A", 60)]), day("2026-10-25", [])];
  const sessions = [
    session({ kind: "A", status: "done", date: "2026-10-20", elapsedSec: 1800 }),
    session({ kind: "A", status: "active", date: "2026-11-01", elapsedSec: 900 }),
  ];
  const heatmap = buildHeatmap({ days, sessions, today: TODAY });

  it("tem 28 células em 4 semanas de segunda a domingo", () => {
    assert.equal(heatmap.windowDays, 28);
    assert.equal(heatmap.weeks.length, 4);
    assert.equal(heatmap.weeks[0].start, "2026-10-05");
    assert.equal(heatmap.weeks[0].label, "05/10");
    for (const week of heatmap.weeks) {
      assert.equal(week.cells.length, 7);
      assert.ok(week.cells.every((cell) => cell !== null));
    }
    assert.deepEqual(heatmap.weekdayInitials, ["S", "T", "Q", "Q", "S", "S", "D"]);
  });

  it("rotula cada célula como 'DD/MM: N min'", () => {
    const cell = heatmap.weeks[2].cells[1];
    assert.equal(cell?.date, "2026-10-20");
    assert.equal(cell?.ariaLabel, "20/10: 30 min");
    assert.equal(cell?.level, 3);
  });

  it("marca hoje, o dia livre e os totais da janela", () => {
    const todayCell = heatmap.weeks[3].cells[6];
    assert.equal(todayCell?.isToday, true);
    assert.equal(todayCell?.minutes, 15);
    assert.equal(todayCell?.level, 2);

    const restCell = heatmap.weeks[2].cells[6];
    assert.equal(restCell?.date, "2026-10-25");
    assert.equal(restCell?.rest, true);

    assert.equal(heatmap.maxMinutes, 30);
    assert.equal(heatmap.totalMinutes, 45);
  });
});

describe("planVsReal: tempo por assunto do plano", () => {
  it("agrupa pelo início do conteúdo e ordena pelo planejado", () => {
    const days = [
      day("2026-11-01", [block("A", 60, "Matemática: funções"), block("B", 30, "Física: leis")]),
      day("2026-11-02", [block("A", 60, "Matemática: funções")]),
    ];
    const sessions = [
      session({ kind: "A", status: "done", date: "2026-11-01", elapsedSec: 3600 }),
      session({ kind: "B", status: "done", date: "2026-11-01", elapsedSec: 600 }),
    ];

    const rows = planVsReal({ days, sessions });
    assert.deepEqual(
      rows.map((row) => [row.label, row.plannedMin, row.studiedMin, row.pct]),
      [
        ["Matemática", 120, 60, 50],
        ["Física", 30, 10, 33],
      ],
    );
    assert.equal(planVsReal({ days, sessions, limit: 1 }).length, 1);
  });

  it("mantém minutos de blocos que saíram do plano pelo tipo", () => {
    const rows = planVsReal({
      days: [],
      sessions: [session({ kind: "B", status: "done", elapsedSec: 1200 })],
    });
    assert.deepEqual(
      rows.map((row) => [row.label, row.plannedMin, row.studiedMin]),
      [["Bloco B", 0, 20]],
    );
  });

  it("deriva a matéria do bloco do plano quando a sessão não tem matéria", () => {
    const days = [
      day("2026-11-01", [
        block("A", 60, "Matemática: funções"),
        block("B", 0, "Física: leis"),
      ]),
    ];
    const sessions = [
      session({
        id: "a",
        kind: "A",
        status: "done",
        date: "2026-11-01",
        elapsedSec: 3600,
      }),
      session({
        id: "b",
        kind: "B",
        status: "done",
        date: "2026-11-01",
        elapsedSec: 600,
      }),
      session({
        id: "a-biologia",
        kind: "A",
        status: "done",
        date: "2026-11-01",
        elapsedSec: 1200,
        subject: "Biologia",
      }),
    ];

    const rows = planVsReal({ days, sessions });
    assert.deepEqual(
      rows.map((row) => [row.label, row.plannedMin, row.studiedMin]),
      [
        ["Matemática", 60, 60],
        ["Biologia", 0, 20],
        ["Física", 0, 10],
      ],
    );
    assert.ok(rows.every((row) => !row.label.startsWith("Bloco")));
  });
});

describe("weakTopics: matérias do plano em vez de rótulo de bloco", () => {
  it("cruza a sessão e a questão com o bloco do dia do plano", () => {
    const days = [
      day("2026-11-01", [
        block("A", 60, "Matemática: funções"),
        block("B", 30, "Física: leis"),
      ]),
    ];
    const sessions = [
      session({
        id: "s-a",
        kind: "A",
        status: "done",
        date: "2026-11-01",
        elapsedSec: 600,
        correct: 1,
        wrong: 1,
      }),
      session({
        id: "s-b",
        kind: "B",
        status: "done",
        date: "2026-11-01",
        elapsedSec: 600,
        correct: 2,
        wrong: 0,
      }),
    ];
    const mistakes = [
      mistake({
        id: "externa",
        sessionId: "externo",
        date: "2026-11-01",
        kind: "A",
        subject: "Biologia",
      }),
      mistake({ id: "sem-sessao", sessionId: "sumiu", date: "2026-11-01", kind: "B" }),
    ];

    const labels = weakTopics({ days, sessions, mistakes }).map((topic) => topic.label);
    assert.deepEqual([...labels].sort(), ["Biologia", "Física", "Matemática"]);
    assert.ok(labels.every((label) => !label.startsWith("Bloco")));
  });
});

describe("reasonRows: motivos dos erros", () => {
  it("ignora motivos sem registro e ordena do mais frequente", () => {
    const rows = reasonRows([
      mistake({ errorReason: "atencao" }),
      mistake({ errorReason: "atencao" }),
      mistake({ errorReason: "tempo" }),
      mistake(),
    ]);
    assert.deepEqual(
      rows.map((row) => [row.key, row.count, row.pct]),
      [
        ["atencao", 2, 50],
        ["tempo", 1, 25],
        ["sem_causa", 1, 25],
      ],
    );
  });

  it("sem erros devolve lista vazia", () => {
    assert.deepEqual(reasonRows([]), []);
  });
});

describe("planDayRows: dias do plano compactos", () => {
  it("classifica feito, parcial, falta, livre e futuro", () => {
    const days = [
      day("2026-10-30", [block("A", 60)]),
      day("2026-10-31", [block("A", 60)]),
      day("2026-11-01", [block("A", 60)]),
      day("2026-11-02", [block("A", 60)]),
      day("2026-11-03", []),
    ];
    const sessions = [
      session({ kind: "A", status: "done", date: "2026-10-31", elapsedSec: 3600 }),
      session({ kind: "A", status: "active", date: "2026-11-01", elapsedSec: 600 }),
    ];
    const rows = planDayRows(days, sessions, TODAY);
    assert.deepEqual(
      rows.map((row) => [row.date, row.state, row.isToday]),
      [
        ["2026-10-30", "falta", false],
        ["2026-10-31", "feito", false],
        ["2026-11-01", "parcial", true],
        ["2026-11-02", "vem", false],
        ["2026-11-03", "livre", false],
      ],
    );
  });
});

describe("emptyProgressCopy: estado vazio", () => {
  it("aponta para Hoje com o CTA preenchido", () => {
    const copy = emptyProgressCopy();
    assert.equal(copy.kind, "empty");
    assert.equal(copy.message, EMPTY_PROGRESS_MESSAGE);
    assert.equal(copy.action?.label, "Ir para Hoje");
    assert.equal(copy.action?.href, "/");
  });
});

describe("currentStreak: só conta dia com tempo estudado", () => {
  it("abrir o bloco sem iniciar o cronômetro não conta como dia estudado", () => {
    const days = [day("2026-10-31", [block("A", 60)]), day(TODAY, [block("A", 60)])];
    const sessions = [session({ kind: "A", status: "active", date: TODAY, elapsedSec: 0 })];

    assert.equal(currentStreak(days, sessions, TODAY), 0);
    assert.equal(firstFoldMetrics({ days, sessions, today: TODAY })[0].value, "0");
  });

  it("não soma hoje quando a sessão foi aberta mas não estudou nada", () => {
    const days = [day("2026-10-31", [block("A", 60)]), day(TODAY, [block("A", 60)])];
    const sessions = [
      session({ kind: "A", status: "done", date: "2026-10-31", elapsedSec: 600 }),
      session({ kind: "A", status: "active", date: TODAY, elapsedSec: 0 }),
    ];

    assert.equal(currentStreak(days, sessions, TODAY), 1);
  });

  it("conta hoje e ontem quando as duas sessões acumularam segundos", () => {
    const days = [day("2026-10-31", [block("A", 60)]), day(TODAY, [block("A", 60)])];
    const sessions = [
      session({ kind: "A", status: "done", date: "2026-10-31", elapsedSec: 1800 }),
      session({ kind: "A", status: "active", date: TODAY, elapsedSec: 10 }),
    ];

    assert.equal(currentStreak(days, sessions, TODAY), 2);
  });

  it("sete dias pintados no heatmap valem sete na sequência, mesmo fora do plano", () => {
    const dates = [
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ];
    const sessions = dates.map((date, index) =>
      session({
        id: `dia-${index}`,
        kind: "A",
        status: "done",
        date,
        elapsedSec: 1800,
      }),
    );

    const heatmap = buildHeatmap({ days: [], sessions, today: TODAY });
    const painted = heatmap.weeks
      .flatMap((week) => week.cells)
      .filter((cell) => cell && cell.level > 0).length;

    assert.equal(painted, 7);
    assert.equal(currentStreak([], sessions, TODAY), 7);
    assert.equal(firstFoldMetrics({ days: [], sessions, today: TODAY })[0].value, "7");
  });

  it("termina ontem quando hoje ainda não tem estudo", () => {
    const dates = [
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ];
    const sessions = dates.map((date, index) =>
      session({
        id: `ontem-${index}`,
        kind: "A",
        status: "done",
        date,
        elapsedSec: 1800,
      }),
    );

    assert.equal(currentStreak([], sessions, TODAY), 7);
  });
});

describe("isEmptyProgress: condição do estado vazio", () => {
  it("é vazio sem tempo estudado e sem questão respondida", () => {
    assert.equal(isEmptyProgress([]), true);
    assert.equal(
      isEmptyProgress([session({ kind: "A", status: "active", elapsedSec: 0 })]),
      true,
    );
  });

  it("deixa de ser vazio com tempo estudado ou com questão respondida", () => {
    assert.equal(
      isEmptyProgress([session({ kind: "A", status: "active", elapsedSec: 30 })]),
      false,
    );
    assert.equal(
      isEmptyProgress([session({ kind: "A", status: "active", elapsedSec: 0, correct: 1 })]),
      false,
    );
  });

  it("soma segundos estudados e questões respondidas", () => {
    const sessions = [
      session({ kind: "A", status: "done", elapsedSec: 90, correct: 2, wrong: 1 }),
      session({ kind: "B", status: "done", elapsedSec: 30, correct: 1, wrong: 0 }),
    ];
    assert.equal(totalStudiedSeconds(sessions), 120);
    assert.equal(totalAnsweredQuestions(sessions), 4);
  });
});

describe("hasQuestionDiagnostics: cartões de questões e erros", () => {
  it("fica oculto sem questão respondida nem erro no caderno", () => {
    assert.equal(hasQuestionDiagnostics({ sessions: [], mistakes: [] }), false);
    assert.equal(
      hasQuestionDiagnostics({
        sessions: [session({ kind: "A", status: "active", elapsedSec: 600 })],
        mistakes: [],
      }),
      false,
    );
  });

  it("aparece com questão respondida", () => {
    assert.equal(
      hasQuestionDiagnostics({
        sessions: [session({ kind: "A", status: "done", elapsedSec: 600, correct: 1 })],
        mistakes: [],
      }),
      true,
    );
  });

  it("aparece com erro anotado no caderno mesmo sem sessão", () => {
    assert.equal(hasQuestionDiagnostics({ sessions: [], mistakes: [mistake()] }), true);
  });
});
