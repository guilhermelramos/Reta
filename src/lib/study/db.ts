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
    mistakes,
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
