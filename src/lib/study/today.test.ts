import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blockState,
  emptyBlocksLine,
  isLatePending,
  isPrepDismissed,
  LATE_GRACE_MIN,
  loadBlocks,
  nextAction,
  prepSuggestionVisible,
  showsShortSession,
  studiedMinutesFor,
  weekKey,
} from "./today.ts";
import type { BlockKind, PlanBlock, StudySession } from "./types.ts";

const DATE = "2026-11-01";

function block(kind: BlockKind, plannedMin: number, content = `${kind} · conteúdo`): PlanBlock {
  return { kind, content, plannedMin };
}

function session(
  overrides: Partial<StudySession> & Pick<StudySession, "kind" | "status">,
): StudySession {
  return {
    id: `session-${overrides.kind}-${overrides.status}`,
    date: DATE,
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

describe("blockState: estado do bloco no dia", () => {
  it("sem sessão é pendente", () => {
    assert.equal(blockState([], DATE, "A"), "idle");
  });

  it("uma sessão concluída marca o bloco como concluído", () => {
    const sessions = [session({ kind: "A", status: "done", elapsedSec: 600 })];
    assert.equal(blockState(sessions, DATE, "A"), "done");
  });

  it("em andamento vence concluído (retomada abre uma sessão nova)", () => {
    const sessions = [
      session({ kind: "A", status: "done", elapsedSec: 600 }),
      session({ kind: "A", status: "active", elapsedSec: 120 }),
    ];
    assert.equal(blockState(sessions, DATE, "A"), "active");
  });

  it("ignora sessões de outro dia e de outro bloco", () => {
    const sessions = [
      session({ kind: "A", status: "done", date: "2026-10-31" }),
      session({ kind: "B", status: "done" }),
    ];
    assert.equal(blockState(sessions, DATE, "A"), "idle");
  });
});

describe("studiedMinutesFor: minutos reais do bloco", () => {
  it("soma todas as sessões do dia e arredonda para minutos", () => {
    const sessions = [
      session({ kind: "A", status: "done", elapsedSec: 600 }),
      session({ kind: "A", status: "active", elapsedSec: 125 }),
      session({ kind: "B", status: "done", elapsedSec: 900 }),
    ];
    assert.equal(studiedMinutesFor(sessions, DATE, "A"), 12);
  });

  it("ignora valores inválidos e negativos", () => {
    const sessions = [
      session({ kind: "A", status: "done", elapsedSec: Number.NaN }),
      session({ kind: "A", status: "done", elapsedSec: -30 }),
      session({ kind: "A", status: "done", elapsedSec: 59 }),
    ];
    assert.equal(studiedMinutesFor(sessions, DATE, "A"), 1);
  });
});

describe("nextAction: próxima ação do dia", () => {
  it("ignora blocos sem carga e escolhe o primeiro pendente", () => {
    const blocks = [block("A", 0), block("B", 45)];
    assert.deepEqual(nextAction(blocks, [], DATE), { block: blocks[1], state: "idle" });
  });

  it("pula blocos concluídos", () => {
    const blocks = [block("A", 60), block("B", 45)];
    const sessions = [session({ kind: "A", status: "done" })];
    assert.deepEqual(nextAction(blocks, sessions, DATE), { block: blocks[1], state: "idle" });
  });

  it("timer em andamento tem prioridade, mesmo com bloco anterior pendente", () => {
    const blocks = [block("A", 60), block("B", 45)];
    const sessions = [session({ kind: "B", status: "active" })];
    assert.deepEqual(nextAction(blocks, sessions, DATE), { block: blocks[1], state: "active" });
  });

  it("dia sem carga não inventa próxima ação", () => {
    assert.equal(nextAction([block("A", 0), block("B", 0)], [], DATE), null);
  });

  it("tudo concluído devolve null (a tela mostra o cartão de conclusão)", () => {
    const blocks = [block("A", 60), block("B", 45)];
    const sessions = [
      session({ kind: "A", status: "done" }),
      session({ kind: "B", status: "done" }),
    ];
    assert.equal(nextAction(blocks, sessions, DATE), null);
  });

  it("loadBlocks mantém só quem tem tempo planejado", () => {
    const blocks = [block("A", 60), block("B", 0), block("R", 15)];
    assert.deepEqual(
      loadBlocks(blocks).map((item) => item.kind),
      ["A", "R"],
    );
  });
});

describe('showsShortSession: "Só 15 min" só no herói pendente com 30+ min', () => {
  it("bloco pendente com 30 min ou mais mostra o atalho", () => {
    assert.equal(showsShortSession("idle", 30), true);
    assert.equal(showsShortSession("idle", 60), true);
  });

  it("bloco pendente com menos de 30 min não mostra", () => {
    assert.equal(showsShortSession("idle", 29), false);
    assert.equal(showsShortSession("idle", 15), false);
    assert.equal(showsShortSession("idle", 0), false);
  });

  it("bloco em andamento nunca mostra (o CTA é Continuar)", () => {
    assert.equal(showsShortSession("active", 60), false);
  });

  it("bloco concluído nunca mostra", () => {
    assert.equal(showsShortSession("done", 60), false);
  });

  it("duração inválida não vira atalho", () => {
    assert.equal(showsShortSession("idle", Number.NaN), false);
  });
});

describe("isLatePending: badge Atrasado no bloco pendente", () => {
  const STUDY_MIN = 14 * 60; // 14:00

  it("depois do horário de estudo + tolerância fica atrasado", () => {
    assert.equal(isLatePending("idle", STUDY_MIN + LATE_GRACE_MIN, STUDY_MIN), true);
    assert.equal(isLatePending("idle", STUDY_MIN + LATE_GRACE_MIN + 1, STUDY_MIN), true);
  });

  it("antes da tolerância não fica atrasado", () => {
    assert.equal(isLatePending("idle", STUDY_MIN + LATE_GRACE_MIN - 1, STUDY_MIN), false);
    assert.equal(isLatePending("idle", STUDY_MIN, STUDY_MIN), false);
  });

  it("só vale para bloco pendente", () => {
    assert.equal(isLatePending("active", STUDY_MIN + 120, STUDY_MIN), false);
    assert.equal(isLatePending("done", STUDY_MIN + 120, STUDY_MIN), false);
  });

  it("sem horário válido na store não sinaliza atraso", () => {
    assert.equal(isLatePending("idle", STUDY_MIN + 120, Number.NaN), false);
    assert.equal(isLatePending("idle", Number.NaN, STUDY_MIN), false);
    assert.equal(isLatePending("idle", STUDY_MIN + 120, STUDY_MIN, Number.NaN), false);
  });

  it("aceita outra tolerância quando o chamador precisar", () => {
    assert.equal(isLatePending("idle", STUDY_MIN + 10, STUDY_MIN, 10), true);
    assert.equal(isLatePending("idle", STUDY_MIN + 9, STUDY_MIN, 10), false);
  });
});

describe("emptyBlocksLine: blocos vazios numa linha só", () => {
  it("junta os blocos sem carga na ordem do plano", () => {
    const blocks = [block("A", 60), block("B", 0), block("R", 0), block("L", 0)];
    assert.equal(emptyBlocksLine(blocks), "Bloco B, Revisão e Leitura: sem carga hoje");
  });

  it("com um bloco só não usa vírgula nem 'e'", () => {
    assert.equal(emptyBlocksLine([block("B", 0)]), "Bloco B: sem carga hoje");
  });

  it("com dois blocos usa 'e' antes do último", () => {
    assert.equal(
      emptyBlocksLine([block("B", 0), block("R", 0)]),
      "Bloco B e Revisão: sem carga hoje",
    );
  });

  it("dia cheio não gera linha", () => {
    assert.equal(emptyBlocksLine([block("A", 60), block("R", 20)]), null);
    assert.equal(emptyBlocksLine([]), null);
  });

  it("tempo inválido conta como sem carga", () => {
    assert.equal(emptyBlocksLine([block("A", Number.NaN)]), "Bloco A: sem carga hoje");
  });
});

describe("weekKey: segunda-feira da semana", () => {
  it("segunda-feira é a própria chave", () => {
    assert.equal(weekKey("2026-10-26"), "2026-10-26");
  });

  it("domingo aponta para a segunda-feira anterior", () => {
    assert.equal(weekKey("2026-11-01"), "2026-10-26");
  });

  it("atravessa a virada do mês e do ano", () => {
    assert.equal(weekKey("2026-11-02"), "2026-11-02");
    assert.equal(weekKey("2027-01-01"), "2026-12-28");
  });

  it("data inválida volta sem alteração", () => {
    assert.equal(weekKey("sem-data"), "sem-data");
  });
});

describe("dispensa semanal do Preparar semana", () => {
  it("dispensado na mesma semana fica oculto", () => {
    assert.equal(isPrepDismissed("2026-10-26", "2026-11-01"), true);
    assert.equal(isPrepDismissed("2026-10-26", "2026-10-29"), true);
  });

  it("na semana seguinte a sugestão volta", () => {
    assert.equal(isPrepDismissed("2026-10-26", "2026-11-02"), false);
    assert.equal(
      prepSuggestionVisible({
        dismissedWeek: "2026-10-26",
        today: "2026-11-02",
        running: false,
      }),
      true,
    );
  });

  it("sem dispensa gravada a sugestão aparece", () => {
    assert.equal(isPrepDismissed("", "2026-11-01"), false);
    assert.equal(
      prepSuggestionVisible({ dismissedWeek: "", today: "2026-11-01", running: false }),
      true,
    );
  });

  it("enquanto a preparação corre o cartão continua visível", () => {
    assert.equal(
      prepSuggestionVisible({
        dismissedWeek: "2026-10-26",
        today: "2026-11-01",
        running: true,
      }),
      true,
    );
  });
});
