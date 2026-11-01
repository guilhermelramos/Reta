import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import {
  buildBackupFile,
  parseBackupText,
  redactBackup,
  serializeBackup,
  type BackupFile,
  type BackupSnapshot,
  type FullBackup,
} from "./backup.ts";
import { EMPTY_SETTINGS, type Doubt, type Mistake, type PlanDay, type Settings, type StudyPackage, type StudySession } from "./types.ts";

const SECRETS = {
  xai: "xai-secret-nao-pode-vazar-123",
  perplexity: "pplx-secret-nao-pode-vazar-456",
  gemini: "gemini-secret-nao-pode-vazar-789",
  claude: "claude-secret-nao-pode-vazar-000",
};

function makeSnapshot(): BackupSnapshot {
  const days: PlanDay[] = [
    {
      date: "2026-11-01",
      phase: "Fase 1",
      blocks: [
        { kind: "A", content: "Função afim", plannedMin: 40 },
        { kind: "R", content: "Revisão de ontem", plannedMin: 20 },
      ],
    },
    { date: "2026-11-02", phase: "Fase 1", blocks: [{ kind: "B", content: "Progressão", plannedMin: 45 }] },
  ];
  const packages = [
    { id: "2026-11-01:A", date: "2026-11-01", kind: "A", topic: "Função afim", generatedAt: 1 },
  ] as unknown as StudyPackage[];
  const sessions = [
    { id: "s-1", date: "2026-11-01", kind: "A", mode: "cheio", elapsedSec: 600, status: "done" },
  ] as unknown as StudySession[];
  const mistakes = [
    { id: "m-1", sessionId: "s-1", date: "2026-11-01", kind: "A", topic: "Função afim", reviewed: true, srsStage: 3 },
  ] as unknown as Mistake[];
  const doubts: Doubt[] = [
    {
      id: "d-1",
      blockId: "2026-11-01:A",
      title: "Por que o b é o corte no eixo y?",
      status: "aberta",
      updatedAt: 1,
      messages: [{ role: "user", text: "Por quê?" }],
    },
  ];
  const settings = {
    ...EMPTY_SETTINGS,
    studyHour: 7,
    studyMinute: 30,
    keys: { ...SECRETS },
  } satisfies Settings & { keys: typeof SECRETS };
  return {
    days,
    packages,
    sessions,
    mistakes,
    settings,
    doubts,
    meta: {
      notifyLog: { start: "2026-11-01" },
      seeded: true,
      activeSession: { sessionId: "s-1", blockKey: "2026-11-01:A:cheio" },
      settings,
    },
    exportedAt: "2026-11-01T12:00:00.000Z",
  };
}

describe("backup: serialização e validação", () => {
  it("faz ida e volta preservando os dados de estudo", () => {
    const snapshot = makeSnapshot();
    const backup = buildBackupFile(snapshot);
    const parsed: BackupFile = parseBackupText(serializeBackup(backup));

    assert.equal(parsed.app, "reta");
    assert.equal(parsed.exportedAt, snapshot.exportedAt);
    assert.deepEqual(parsed.days, snapshot.days);
    assert.deepEqual(parsed.packages, snapshot.packages);
    assert.deepEqual(parsed.sessions, snapshot.sessions);
    assert.deepEqual(parsed.mistakes, snapshot.mistakes);
    assert.deepEqual(parsed.doubts, snapshot.doubts);
    assert.equal(parsed.settings?.studyHour, 7);
    assert.equal(parsed.settings?.studyMinute, 30);
    assert.deepEqual(parsed.meta?.notifyLog, { start: "2026-11-01" });
    assert.equal(parsed.meta?.seeded, true);
  });

  it("preserva campos desconhecidos dentro dos registros (compatibilidade)", () => {
    const snapshot = makeSnapshot();
    (snapshot.days[0] as PlanDay & { extra?: string }).extra = "campo de versão futura";
    const parsed = parseBackupText(serializeBackup(buildBackupFile(snapshot)));
    assert.equal((parsed.days[0] as PlanDay & { extra?: string }).extra, "campo de versão futura");
  });
});

describe("backup: chaves de API", () => {
  it("não escreve nenhuma chave no JSON exportado", () => {
    const json = serializeBackup(buildBackupFile(makeSnapshot()));
    for (const secret of Object.values(SECRETS)) {
      assert.equal(json.includes(secret), false, `a chave ${secret} vazou no backup`);
    }
  });

  it("não inclui settings.keys nem meta.settings.keys no arquivo", () => {
    const parsed = parseBackupText(serializeBackup(buildBackupFile(makeSnapshot())));
    assert.equal(parsed.settings?.keys, undefined);
    const metaSettings = parsed.meta?.settings as { keys?: unknown } | undefined;
    assert.equal(metaSettings?.keys, undefined);
  });

  it("remove chaves mesmo de um backup montado fora do buildBackupFile", () => {
    const snapshot = makeSnapshot();
    const raw = buildBackupFile(snapshot);
    const withSecrets: FullBackup = {
      ...raw,
      settings: Object.assign({}, raw.settings, { keys: { ...SECRETS } }),
      meta: { ...raw.meta, settings: Object.assign({}, raw.settings, { keys: { ...SECRETS } }) },
    };
    assert.equal(serializeBackup(withSecrets).includes(SECRETS.xai), false);
    assert.equal(serializeBackup(redactBackup(withSecrets)).includes(SECRETS.perplexity), false);
  });

  it("aceita backup antigo com chaves na leitura, mas não as reexporta", () => {
    const legacy = {
      app: "reta",
      days: [],
      packages: [],
      sessions: [],
      mistakes: [],
      settings: { keys: { xai: SECRETS.xai } },
    };
    const parsed = parseBackupText(JSON.stringify(legacy));
    const legacySettings = (keys: unknown) =>
      Object.assign({}, EMPTY_SETTINGS, {
        keys: { ...(typeof keys === "object" && keys ? keys : {}) },
      });
    const again = serializeBackup({
      app: "reta",
      formatVersion: 1,
      exportedAt: "2026-11-01T12:00:00.000Z",
      days: parsed.days as PlanDay[],
      packages: parsed.packages as StudyPackage[],
      sessions: parsed.sessions as StudySession[],
      mistakes: parsed.mistakes as Mistake[],
      settings: legacySettings(parsed.settings?.keys),
      doubts: [],
      meta: { settings: legacySettings(parsed.settings?.keys) },
    });
    assert.equal(again.includes(SECRETS.xai), false);
  });
});

describe("backup: arquivo inválido", () => {
  it("rejeita arquivo vazio e JSON quebrado como SyntaxError", () => {
    assert.throws(() => parseBackupText("   "), SyntaxError);
    assert.throws(() => parseBackupText("{"), SyntaxError);
  });

  it("rejeita JSON válido com formato errado como ZodError", () => {
    assert.throws(() => parseBackupText(JSON.stringify({ days: "nada" })), ZodError);
    assert.throws(() => parseBackupText(JSON.stringify({ packages: [], sessions: [], mistakes: [] })), ZodError);
  });

  it("aceita backup mínimo válido", () => {
    const parsed = parseBackupText(JSON.stringify({ days: [], packages: [], sessions: [], mistakes: [] }));
    assert.deepEqual(parsed.days, []);
    assert.equal(parsed.settings, undefined);
  });
});
