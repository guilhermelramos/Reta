import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dueNotices } from "./notify.ts";
import {
  REMINDER_HORIZON_DAYS,
  buildReminderSchedule,
  reminderNotificationId,
  saoPauloDateTime,
} from "./notification-schedule.ts";
import type { PlanDay, Settings, StudySession } from "./types.ts";
import { EMPTY_SETTINGS } from "./types.ts";

function settings(patch: Partial<Settings> = {}): Settings {
  return {
    ...EMPTY_SETTINGS,
    ...patch,
    alerts: { ...EMPTY_SETTINGS.alerts, ...(patch.alerts ?? {}) },
    keys: { ...EMPTY_SETTINGS.keys, ...(patch.keys ?? {}) },
  };
}

const DAY: PlanDay = {
  date: "2026-03-10",
  phase: "Fase 1",
  blocks: [
    { kind: "A", content: "Matemática: funções", plannedMin: 40 },
    { kind: "B", content: "Física: cinemática", plannedMin: 30 },
    { kind: "R", content: "Revisão de ontem", plannedMin: 15 },
  ],
};

const NEXT_DAY: PlanDay = {
  ...DAY,
  date: "2026-03-11",
  blocks: [
    { kind: "A", content: "Química: estequiometria", plannedMin: 50 },
    { kind: "B", content: "Biologia: citologia", plannedMin: 25 },
    { kind: "R", content: "Revisão de química", plannedMin: 15 },
  ],
};

// 09:00 em São Paulo, antes do horário de estudo padrão (14:00).
const MORNING = new Date("2026-03-10T12:00:00.000Z");

function build(input: {
  now?: Date;
  current?: PlanDay;
  settings?: Settings;
  sessions?: StudySession[];
  log?: Record<string, string>;
  days?: PlanDay[];
  horizonDays?: number;
}) {
  return buildReminderSchedule({
    settings: input.settings ?? settings(),
    days: input.days ?? (input.current ? [input.current] : [DAY]),
    sessions: input.sessions ?? [],
    log: input.log ?? {},
    now: input.now ?? MORNING,
    horizonDays: input.horizonDays,
  });
}

function iso(reminders: ReturnType<typeof build>): string[] {
  return reminders.map((reminder) => reminder.at.toISOString());
}

describe("notification-schedule: horário de São Paulo", () => {
  it("converte 14:00 de São Paulo para 17:00 UTC", () => {
    assert.equal(saoPauloDateTime("2026-03-10", 14, 0).toISOString(), "2026-03-10T17:00:00.000Z");
  });

  it("rola a hora que passa da meia-noite para o dia seguinte", () => {
    assert.equal(saoPauloDateTime("2026-03-10", 24, 15).toISOString(), "2026-03-11T03:15:00.000Z");
  });
});

describe("notification-schedule: avisos do dia", () => {
  it("agenda início, questões, revisão e bloco não iniciado nos horários certos", () => {
    const reminders = build({});

    assert.deepEqual(
      reminders.map((reminder) => reminder.tag),
      ["start", "questions", "review", "pending"],
    );
    assert.deepEqual(iso(reminders), [
      "2026-03-10T17:00:00.000Z",
      "2026-03-10T17:20:00.000Z",
      "2026-03-10T17:40:00.000Z",
      "2026-03-10T17:45:00.000Z",
    ]);
    assert.deepEqual(
      reminders.map((reminder) => reminder.channelId),
      ["estudo", "questoes", "estudo", "estudo"],
    );
    assert.equal(reminders[0]?.title, "Hora de estudar");
    assert.match(reminders[0]?.body ?? "", /Matemática: funções · 40 min/);
    assert.match(reminders[2]?.body ?? "", /Revisão: Revisão de ontem · 15 min/);
    assert.equal(reminders[3]?.title, "Bloco de hoje ainda não iniciado");
  });

  it("usa o mesmo texto do dueNotices no instante de cada aviso", () => {
    const current = settings();
    const reminders = build({ settings: current });
    for (const reminder of reminders) {
      const due = dueNotices({
        settings: current,
        today: DAY,
        sessions: [],
        log: {},
        now: reminder.at,
      });
      const same = due.find((notice) => notice.tag === reminder.tag);
      assert.ok(same, `dueNotices não trouxe ${reminder.tag} em ${reminder.at.toISOString()}`);
      assert.equal(reminder.title, same.title);
      assert.equal(reminder.body, same.body);
    }
  });

  it("não agenda nada no modo silencioso", () => {
    assert.deepEqual(build({ settings: settings({ quiet: true }) }), []);
  });

  it("respeita os alertas desligados", () => {
    const reminders = build({
      settings: settings({
        alerts: { start: false, questions: true, review: false, pending: false },
      }),
    });
    assert.deepEqual(
      reminders.map((reminder) => reminder.tag),
      ["questions"],
    );
  });

  it("não reagenda aviso que já caiu fora da janela", () => {
    // 14:30 em São Paulo: início (14:00) e questões (14:20) passaram.
    const reminders = build({ now: new Date("2026-03-10T17:30:00.000Z") });
    assert.deepEqual(
      reminders.map((reminder) => reminder.tag),
      ["review", "pending"],
    );
  });

  it("pula o aviso já registrado no notifyLog do dia", () => {
    const reminders = build({ log: { start: DAY.date, review: DAY.date } });
    assert.deepEqual(
      reminders.map((reminder) => reminder.tag),
      ["questions", "pending"],
    );
  });

  it("não avisa 'bloco não iniciado' quando a sessão do dia já começou", () => {
    const sessions: StudySession[] = [
      {
        id: "s1",
        date: DAY.date,
        kind: "A",
        mode: "cheio",
        sheetMin: 40,
        budgetMin: 40,
        bonusMin: 0,
        elapsedSec: 90,
        running: true,
        runStartedAt: MORNING.getTime(),
        status: "active",
        step: "aula",
        diagCorrect: null,
        asked: [],
        correct: 0,
        wrong: 0,
        difficulty: "medio",
        missed: [],
        startedAt: MORNING.getTime(),
        endedAt: null,
      },
    ];
    const reminders = build({
      days: [DAY, NEXT_DAY],
      sessions,
    });
    assert.equal(
      reminders.some((reminder) => reminder.date === DAY.date && reminder.tag === "pending"),
      false,
    );
    assert.equal(
      reminders.some((reminder) => reminder.date === NEXT_DAY.date && reminder.tag === "pending"),
      true,
    );
  });

  it("sem bloco de revisão não cria aviso de revisão", () => {
    const current: PlanDay = {
      ...DAY,
      blocks: [{ kind: "A", content: "Matemática: funções", plannedMin: 40 }],
    };
    const reminders = build({ current });
    assert.equal(
      reminders.some((reminder) => reminder.tag === "review"),
      false,
    );
  });

  it("sem blocos com tempo não agenda nada", () => {
    const current: PlanDay = {
      ...DAY,
      blocks: [{ kind: "A", content: "Matemática: funções", plannedMin: 0 }],
    };
    assert.deepEqual(build({ current }), []);
  });

  it("cobre os próximos dias do plano, limitado pela janela", () => {
    const reminders = build({ days: [DAY, NEXT_DAY], horizonDays: 2 });
    const nextDayTags = reminders
      .filter((reminder) => reminder.date === NEXT_DAY.date)
      .map((reminder) => reminder.tag)
      .sort();
    assert.deepEqual(nextDayTags, ["pending", "questions", "review", "start"]);
    assert.equal(reminders.length, 8);
  });

  it("usa 40 min como padrão da revisão quando não há bloco A", () => {
    const current: PlanDay = {
      ...DAY,
      blocks: [
        { kind: "B", content: "Física: cinemática", plannedMin: 30 },
        { kind: "R", content: "Revisão de ontem", plannedMin: 15 },
      ],
    };
    const reminders = build({ current });
    assert.equal(reminders.find((reminder) => reminder.tag === "review")?.at.toISOString(), "2026-03-10T17:40:00.000Z");
  });

  it("limita a janela padrão a sete dias", () => {
    const days: PlanDay[] = Array.from({ length: 10 }, (_, index) => ({
      ...DAY,
      date: `2026-03-${String(10 + index).padStart(2, "0")}`,
    }));
    const reminders = build({ days });
    assert.equal(new Set(reminders.map((reminder) => reminder.date)).size, REMINDER_HORIZON_DAYS);
  });
});

describe("notification-schedule: ids", () => {
  it("são estáveis, distintos e cabem no inteiro de 32 bits", () => {
    const a = reminderNotificationId("2026-03-10", "start");
    const b = reminderNotificationId("2026-03-10", "start");
    assert.equal(a, b);
    assert.notEqual(a, reminderNotificationId("2026-03-10", "questions"));
    assert.notEqual(a, reminderNotificationId("2026-03-11", "start"));
    assert.ok(Number.isInteger(a) && a >= 1_000_000 && a <= 2_147_483_647);

    const ids = new Set(
      build({ days: [DAY, NEXT_DAY] }).map((reminder) => reminderNotificationId(reminder.date, reminder.tag)),
    );
    assert.equal(ids.size, 8);
  });
});
