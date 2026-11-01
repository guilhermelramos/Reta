import { z } from "zod";
import { clampStage } from "@/lib/study/srs";
import type { Doubt, Mistake, PlanDay, Settings, StudyPackage, StudySession } from "@/lib/study/types";
import type { BlockKind, SessionMode } from "@/lib/study/types";
import { EMPTY_SETTINGS } from "@/lib/study/types";

const DB_NAME = "reta";
const DB_VERSION = 1;

export type DbSnapshot = {
  days: PlanDay[];
  packages: StudyPackage[];
  sessions: StudySession[];
  mistakes: Mistake[];
  settings: Settings;
  notifyLog: Record<string, string>;
  seeded: boolean;
  doubts: Doubt[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("days")) db.createObjectStore("days", { keyPath: "date" });
      if (!db.objectStoreNames.contains("packages")) db.createObjectStore("packages", { keyPath: "id" });
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" });
      if (!db.objectStoreNames.contains("mistakes")) db.createObjectStore("mistakes", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Não abri o arquivo local."));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao ler dados locais."));
  });
}

/**
 * Registros antigos do caderno não têm os campos de SRS. Na leitura eles
 * ganham padrões: revisados viram dominados, o resto fica vencido hoje
 * (`nextReviewAt` ausente = deve ser revisto agora).
 */
function normalizeMistake(mistake: Mistake): Mistake {
  return {
    ...mistake,
    reviewed: Boolean(mistake.reviewed),
    srsStage: typeof mistake.srsStage === "number" ? clampStage(mistake.srsStage) : mistake.reviewed ? 5 : 0,
    reviewCount: typeof mistake.reviewCount === "number" ? mistake.reviewCount : 0,
    source: mistake.source ?? "sessao",
  };
}

function all<T>(store: IDBObjectStore): Promise<T[]> {
  return reqToPromise(store.getAll() as IDBRequest<T[]>);
}

export async function loadSnapshot(): Promise<DbSnapshot> {
  const db = await openDb();
  const tx = db.transaction(["days", "packages", "sessions", "mistakes", "meta"], "readonly");
  const [days, packages, sessions, mistakes, settings, notifyLog, seeded, doubts] = await Promise.all([
    all<PlanDay>(tx.objectStore("days")),
    all<StudyPackage>(tx.objectStore("packages")),
    all<StudySession>(tx.objectStore("sessions")),
    all<Mistake>(tx.objectStore("mistakes")),
    reqToPromise(tx.objectStore("meta").get("settings") as IDBRequest<Settings | undefined>),
    reqToPromise(tx.objectStore("meta").get("notifyLog") as IDBRequest<Record<string, string> | undefined>),
    reqToPromise(tx.objectStore("meta").get("seeded") as IDBRequest<boolean | undefined>),
    reqToPromise(tx.objectStore("meta").get("doubts") as IDBRequest<Doubt[] | undefined>),
  ]);
  db.close();
  days.sort((a, b) => a.date.localeCompare(b.date));
  return {
    days,
    packages,
    sessions,
    mistakes: mistakes.map(normalizeMistake),
    settings: { ...EMPTY_SETTINGS, ...settings, keys: { ...EMPTY_SETTINGS.keys, ...settings?.keys }, alerts: { ...EMPTY_SETTINGS.alerts, ...settings?.alerts } },
    notifyLog: notifyLog ?? {},
    seeded: Boolean(seeded),
    doubts: Array.isArray(doubts) ? doubts : [],
  };
}

async function putAll(storeName: "days" | "packages" | "sessions" | "mistakes", rows: { id?: string; date?: string }[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const row of rows) store.put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao salvar."));
  });
  db.close();
}

export async function saveDays(days: PlanDay[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("days", "readwrite");
    const store = tx.objectStore("days");
    store.clear();
    for (const day of days) store.put(day);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao salvar o plano."));
  });
  db.close();
}

export function savePackage(pkg: StudyPackage): Promise<void> {
  return putAll("packages", [pkg]);
}

export function saveSession(session: StudySession): Promise<void> {
  return putAll("sessions", [session]);
}

export function saveMistake(mistake: Mistake): Promise<void> {
  return putAll("mistakes", [mistake]);
}

export async function saveMeta(key: "settings" | "notifyLog" | "seeded" | "doubts", value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao salvar ajuste."));
  });
  db.close();
}

/* ------------------------------------------------------------------ *
 * Sessão ativa (timer resiliente)
 *
 * Guardada na store `meta` que já existe, numa chave própria: não mexe na
 * versão do banco nem em stores de outros fluxos.
 * ------------------------------------------------------------------ */

const ACTIVE_SESSION_KEY = "activeSession";

/** Estado do cronômetro da sessão em andamento, para sobreviver a reload/revive. */
export type ActiveSessionRecord = {
  /** `${date}:${kind}:${mode}` — identifica o bloco aberto. */
  blockKey: string;
  sessionId: string;
  date: string;
  kind: BlockKind;
  mode: SessionMode;
  running: boolean;
  /** Epoch ms do trecho atual; `null` quando pausado. */
  startedAt: number | null;
  /** Milissegundos já acumulados dos trechos anteriores. */
  accumulatedElapsedMs: number;
  budgetMin: number;
  updatedAt: number;
};

function normalizeActiveSession(raw: unknown): ActiveSessionRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<ActiveSessionRecord>;
  if (!row.sessionId || !row.blockKey || !row.date || !row.kind || !row.mode) return null;
  return {
    blockKey: row.blockKey,
    sessionId: row.sessionId,
    date: row.date,
    kind: row.kind,
    mode: row.mode,
    running: Boolean(row.running),
    startedAt: typeof row.startedAt === "number" ? row.startedAt : null,
    accumulatedElapsedMs:
      typeof row.accumulatedElapsedMs === "number" && Number.isFinite(row.accumulatedElapsedMs)
        ? Math.max(0, row.accumulatedElapsedMs)
        : 0,
    budgetMin: typeof row.budgetMin === "number" ? Math.max(0, row.budgetMin) : 0,
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : 0,
  };
}

export async function saveActiveSession(record: ActiveSessionRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put(record, ACTIVE_SESSION_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao salvar a sessão ativa."));
  });
  db.close();
}

export async function loadActiveSession(): Promise<ActiveSessionRecord | null> {
  const db = await openDb();
  const raw = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const req = tx.objectStore("meta").get(ACTIVE_SESSION_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao ler a sessão ativa."));
  });
  db.close();
  return normalizeActiveSession(raw);
}

export async function clearActiveSession(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").delete(ACTIVE_SESSION_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao limpar a sessão ativa."));
  });
  db.close();
}

/* ------------------------------------------------------------------ *
 * Backup completo (exportar / restaurar)
 *
 * Formato estável e legível: as stores days/packages/sessions/mistakes
 * vão como arrays; `settings` e `doubts` aparecem no topo (são chaves da
 * store `meta`) e `meta` guarda o restante das chaves existentes, incluindo
 * notifyLog, seeded, activeSession e qualquer chave futura.
 * ------------------------------------------------------------------ */

const backupBlockKindSchema = z.enum(["A", "B", "R", "L"]);

const backupPlanBlockSchema = z.looseObject({
  kind: backupBlockKindSchema,
  content: z.string(),
  plannedMin: z.number(),
});

const backupPlanDaySchema = z.looseObject({
  date: z.string().min(1),
  phase: z.string(),
  blocks: z.array(backupPlanBlockSchema),
});

const backupSettingsSchema = z.looseObject({
  studyHour: z.number().optional(),
  studyMinute: z.number().optional(),
  alerts: z
    .looseObject({
      start: z.boolean().optional(),
      review: z.boolean().optional(),
      questions: z.boolean().optional(),
      pending: z.boolean().optional(),
    })
    .optional(),
  quiet: z.boolean().optional(),
  researcher: z.enum(["grok", "perplexity", "gemini", "claude"]).optional(),
  keys: z
    .looseObject({
      xai: z.string().optional(),
      perplexity: z.string().optional(),
      gemini: z.string().optional(),
      claude: z.string().optional(),
    })
    .optional(),
  webSearch: z.boolean().optional(),
});

const backupPackageSchema = z.looseObject({
  id: z.string().min(1),
  date: z.string().min(1),
  kind: backupBlockKindSchema,
});

const backupSessionSchema = z.looseObject({
  id: z.string().min(1),
  date: z.string().min(1),
  kind: backupBlockKindSchema,
});

const backupMistakeSchema = z.looseObject({
  id: z.string().min(1),
});

const backupDoubtSchema = z.looseObject({
  id: z.string().min(1),
});

/**
 * Esquema do arquivo `.json` gerado por `exportAll()`. Campos desconhecidos
 * dentro de cada registro são preservados (`looseObject`), então versões
 * antigas e novas do app continuam compatíveis.
 */
export const backupSchema = z.object({
  app: z.literal("reta").optional(),
  formatVersion: z.number().optional(),
  exportedAt: z.string().optional(),
  days: z.array(backupPlanDaySchema),
  packages: z.array(backupPackageSchema),
  sessions: z.array(backupSessionSchema),
  mistakes: z.array(backupMistakeSchema),
  settings: backupSettingsSchema.optional(),
  doubts: z.array(backupDoubtSchema).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type BackupFile = z.infer<typeof backupSchema>;

export type FullBackup = {
  app: "reta";
  formatVersion: number;
  exportedAt: string;
  days: PlanDay[];
  packages: StudyPackage[];
  sessions: StudySession[];
  mistakes: Mistake[];
  settings: Settings;
  doubts: Doubt[];
  /** Todas as chaves da store `meta`, inclusive settings/doubts/activeSession. */
  meta: Record<string, unknown>;
};

/** Valida o JSON lido do arquivo. Lança `ZodError` quando o formato não bate. */
export function parseBackup(raw: unknown): BackupFile {
  return backupSchema.parse(raw);
}

function mergeSettings(raw: unknown): Settings {
  const source = raw && typeof raw === "object" ? (raw as Partial<Settings>) : {};
  const keys = source.keys && typeof source.keys === "object" ? source.keys : {};
  const alerts = source.alerts && typeof source.alerts === "object" ? source.alerts : {};
  const researcher =
    source.researcher === "grok" ||
    source.researcher === "perplexity" ||
    source.researcher === "gemini" ||
    source.researcher === "claude"
      ? source.researcher
      : EMPTY_SETTINGS.researcher;
  return {
    ...EMPTY_SETTINGS,
    ...source,
    researcher,
    keys: { ...EMPTY_SETTINGS.keys, ...keys },
    alerts: { ...EMPTY_SETTINGS.alerts, ...alerts },
  };
}

/** Lê a store `meta` inteira (tem chaves fora de linha, então usa cursor). */
function readMetaAll(store: IDBObjectStore): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const out: Record<string, unknown> = {};
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      out[String(cursor.key)] = cursor.value;
      cursor.continue();
    };
    req.onerror = () => reject(req.error ?? new Error("Falha ao ler os ajustes locais."));
  });
}

/**
 * Monta o backup completo de todas as stores do IndexedDB do Reta.
 * A leitura é feita numa transação só, para o retrato ser consistente.
 */
export async function exportAll(): Promise<FullBackup> {
  const db = await openDb();
  try {
    const tx = db.transaction(["days", "packages", "sessions", "mistakes", "meta"], "readonly");
    const [days, packages, sessions, mistakes, meta] = await Promise.all([
      all<PlanDay>(tx.objectStore("days")),
      all<StudyPackage>(tx.objectStore("packages")),
      all<StudySession>(tx.objectStore("sessions")),
      all<Mistake>(tx.objectStore("mistakes")),
      readMetaAll(tx.objectStore("meta")),
    ]);
    days.sort((a, b) => a.date.localeCompare(b.date));
    return {
      app: "reta",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      days,
      packages,
      sessions,
      mistakes,
      settings: mergeSettings(meta.settings),
      doubts: Array.isArray(meta.doubts) ? (meta.doubts as Doubt[]) : [],
      meta,
    };
  } finally {
    db.close();
  }
}

/**
 * Substitui todo o conteúdo local pelo backup validado. A transação é única:
 * se algo falhar no meio, o IndexedDB anterior continua intacto.
 */
export async function importAll(backup: BackupFile): Promise<void> {
  const db = await openDb();
  try {
    const meta = backup.meta ?? {};
    const settings = mergeSettings(backup.settings ?? meta.settings);
    const doubts = backup.doubts ?? (Array.isArray(meta.doubts) ? (meta.doubts as Doubt[]) : []);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["days", "packages", "sessions", "mistakes", "meta"], "readwrite");

      const daysStore = tx.objectStore("days");
      daysStore.clear();
      for (const day of backup.days) daysStore.put(day);

      const packagesStore = tx.objectStore("packages");
      packagesStore.clear();
      for (const pkg of backup.packages) packagesStore.put(pkg);

      const sessionsStore = tx.objectStore("sessions");
      sessionsStore.clear();
      for (const session of backup.sessions) sessionsStore.put(session);

      const mistakesStore = tx.objectStore("mistakes");
      mistakesStore.clear();
      for (const mistake of backup.mistakes) mistakesStore.put(mistake);

      const metaStore = tx.objectStore("meta");
      metaStore.clear();
      for (const [key, value] of Object.entries(meta)) metaStore.put(value, key);
      metaStore.put(settings, "settings");
      metaStore.put(doubts, "doubts");

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Falha ao restaurar o backup."));
      tx.onabort = () => reject(tx.error ?? new Error("Restauração do backup cancelada."));
    });
  } finally {
    db.close();
  }
}
