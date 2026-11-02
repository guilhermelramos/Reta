import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dayMonth,
  groupDaysByWeek,
  isOverdueDay,
  overdueDayCount,
  overdueDays,
  overdueLabel,
  planDayState,
  planDayTopics,
  planHeaderLine,
  planScrollTarget,
} from "./plan-schedule.ts";
import type { BlockKind, PlanBlock, PlanDay, StudySession } from "./types.ts";

const TODAY = "2026-11-10";

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
    elapsedSec: 600,
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

describe("groupDaysByWeek: lista agrupada por semana", () => {
  it("agrupa pela segunda-feira e ordena os dias", () => {
    const days = [
      day("2026-11-04", [block("A", 60)]),
      day("2026-11-02", [block("A", 60)]),
      day("2026-11-09", [block("B", 40)]),
    ];
    const weeks = groupDaysByWeek(days);
    assert.equal(weeks.length, 2);
    assert.equal(weeks[0]!.start, "2026-11-02");
    assert.equal(weeks[0]!.label, "Semana de 02/11");
    assert.deepEqual(
      weeks[0]!.days.map((item) => item.date),
      ["2026-11-02", "2026-11-04"],
    );
    assert.equal(weeks[1]!.start, "2026-11-09");
    assert.equal(weeks[1]!.label, "Semana de 09/11");
  });

  it("domingo continua na semana da segunda anterior", () => {
    const weeks = groupDaysByWeek([
      day("2026-11-08", [block("A", 60)]),
      day("2026-11-02", [block("A", 60)]),
    ]);
    assert.equal(weeks.length, 1);
    assert.equal(weeks[0]!.start, "2026-11-02");
    assert.equal(weeks[0]!.days.length, 2);
  });

  it("plano vazio devolve nenhum grupo", () => {
    assert.deepEqual(groupDaysByWeek([]), []);
  });
});

describe("planDayState: estado do dia", () => {
  it("dia sem bloco com carga é descanso", () => {
    const rest = day("2026-11-10", [block("A", 0, ""), block("B", 0, "")]);
    assert.equal(planDayState(rest, []), "descanso");
  });

  it("sem sessão é pendente", () => {
    const target = day("2026-11-10", [block("A", 60)]);
    assert.equal(planDayState(target, []), "pendente");
  });

  it("todos os blocos concluídos é feito", () => {
    const target = day("2026-11-10", [block("A", 60), block("B", 30)]);
    const sessions = [
      session({ kind: "A", status: "done" }),
      session({ kind: "B", status: "done" }),
    ];
    assert.equal(planDayState(target, sessions), "feito");
  });

  it("um bloco concluído é parcial", () => {
    const target = day("2026-11-10", [block("A", 60), block("B", 30)]);
    assert.equal(planDayState(target, [session({ kind: "A", status: "done" })]), "parcial");
  });

  it("bloco em andamento é parcial", () => {
    const target = day("2026-11-10", [block("A", 60), block("B", 30)]);
    assert.equal(planDayState(target, [session({ kind: "A", status: "active" })]), "parcial");
  });

  it("bloco reaberto depois de concluído volta o dia para parcial", () => {
    const target = day("2026-11-10", [block("A", 60)]);
    const sessions = [
      session({ kind: "A", status: "done" }),
      session({ kind: "A", status: "active", id: "reaberto" }),
    ];
    assert.equal(planDayState(target, sessions), "parcial");
  });

  it("ignora sessões de outro dia", () => {
    const target = day("2026-11-10", [block("A", 60)]);
    assert.equal(
      planDayState(target, [session({ kind: "A", status: "done", date: "2026-11-09" })]),
      "pendente",
    );
  });
});

describe("atrasados: dias anteriores com bloco pendente", () => {
  const pending = day("2026-11-09", [block("A", 60)]);
  const done = day("2026-11-08", [block("A", 60)]);
  const rest = day("2026-11-07", [block("A", 0, "")]);
  const todayPending = day(TODAY, [block("A", 60)]);
  const future = day("2026-11-11", [block("A", 60)]);
  const sessions = [session({ kind: "A", status: "done", date: "2026-11-08" })];

  it("conta só dias passados com pendência", () => {
    const days = [pending, done, rest, todayPending, future];
    assert.equal(overdueDayCount(days, sessions, TODAY), 1);
    assert.deepEqual(
      overdueDays(days, sessions, TODAY).map((item) => item.date),
      ["2026-11-09"],
    );
  });

  it("hoje, futuro, descanso e dia concluído não são atrasados", () => {
    assert.equal(isOverdueDay(todayPending, sessions, TODAY), false);
    assert.equal(isOverdueDay(future, sessions, TODAY), false);
    assert.equal(isOverdueDay(rest, sessions, TODAY), false);
    assert.equal(isOverdueDay(done, sessions, TODAY), false);
  });

  it("um bloco pendente já basta para o dia contar", () => {
    const partial = day("2026-11-06", [block("A", 60), block("B", 30)]);
    const oneDone = [session({ kind: "A", status: "done", date: "2026-11-06" })];
    assert.equal(isOverdueDay(partial, oneDone, TODAY), true);
  });

  it("rótulo singular e plural", () => {
    assert.equal(overdueLabel(1), "1 dia atrasado");
    assert.equal(overdueLabel(3), "3 dias atrasados");
    assert.equal(overdueLabel(0), "0 dias atrasados");
  });
});

describe("planScrollTarget: rolagem ao abrir a tela", () => {
  const days = [day("2026-11-02", [block("A", 60)]), day(TODAY, [block("A", 60)])];

  it("com atrasados, para no aviso (o dia de hoje não esconde o alerta)", () => {
    assert.equal(planScrollTarget({ days, today: TODAY, overdueCount: 2 }), "atrasados");
  });

  it("atrasados vencem mesmo sem o dia de hoje no plano", () => {
    const futureOnly = [day("2026-11-20", [block("A", 60)])];
    assert.equal(
      planScrollTarget({ days: futureOnly, today: TODAY, overdueCount: 1 }),
      "atrasados",
    );
  });

  it("sem atrasados, rola até a semana de hoje", () => {
    assert.equal(planScrollTarget({ days, today: TODAY, overdueCount: 0 }), "hoje");
  });

  it("plano sem o dia de hoje não rola", () => {
    const futureOnly = [day("2026-11-20", [block("A", 60)])];
    assert.equal(planScrollTarget({ days: futureOnly, today: TODAY, overdueCount: 0 }), "nenhum");
  });

  it("contagem inválida não vira alvo de atrasados", () => {
    assert.equal(planScrollTarget({ days, today: TODAY, overdueCount: -1 }), "hoje");
  });
});

describe("cabeçalho e tópicos da linha", () => {
  it("monta Planilha · período · N dias", () => {
    const days = [day("2026-11-02", [block("A", 60)]), day("2026-11-09", [block("A", 60)])];
    assert.equal(
      planHeaderLine({ days, sheetName: "Rotina de estudos" }),
      "Planilha: Rotina de estudos · 02/11 a 09/11 · 2 dias",
    );
  });

  it("sem nome cai no plano de exemplo e aceita um dia só", () => {
    const days = [day("2026-11-02", [block("A", 60)])];
    assert.equal(planHeaderLine({ days }), "Planilha: Plano de exemplo · 02/11 · 1 dia");
  });

  it("nome genérico antigo vira Minha planilha só na exibição", () => {
    const days = [day("2026-11-02", [block("A", 60)])];
    assert.equal(
      planHeaderLine({ days, sheetName: "Plano" }),
      "Planilha: Minha planilha · 02/11 · 1 dia",
    );
  });

  it("plano vazio não deixa o nome solto", () => {
    assert.equal(planHeaderLine({ days: [], sheetName: "X" }), "Planilha: X · nenhum dia");
  });

  it("fase vira a primeira linha e os assuntos a segunda", () => {
    const target = day(
      "2026-11-02",
      [block("A", 60, "Matemática: PA"), block("B", 30, "Física: cinemática")],
      "Semana 3",
    );
    assert.deepEqual(planDayTopics(target), {
      title: "Semana 3",
      detail: "Matemática: PA · Física: cinemática",
    });
  });

  it("sem fase usa o primeiro assunto como título, sem repetir", () => {
    const target = day("2026-11-02", [block("A", 60, "Matemática: PA")]);
    assert.deepEqual(planDayTopics(target), { title: "Matemática: PA", detail: "" });
  });

  it("dia sem blocos tem um título legível", () => {
    assert.deepEqual(planDayTopics(day("2026-11-02", [])), {
      title: "Dia sem blocos",
      detail: "",
    });
  });

  it("dayMonth devolve DD/MM", () => {
    assert.equal(dayMonth("2026-11-02"), "02/11");
  });
});
