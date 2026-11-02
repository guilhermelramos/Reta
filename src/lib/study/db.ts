import { buildBackupFile, type BackupFile, type FullBackup } from "@/lib/study/backup";
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
  /** A introdução (/boas-vindas) já foi concluída ou pulada. */
  onboardingDone: boolean;
  doubts: Doubt[];
  /** Segunda-feira da semana em que a sugestão "Preparar semana" foi dispensada. */
  prepDismissedWeek: string;
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
  const [days, packages, sessions, mistakes, settings, notifyLog, seeded, doubts, onboardingDone, prepDismissedWeek] = await Promise.all([
    all<PlanDay>(tx.objectStore("days")),
    all<StudyPackage>(tx.objectStore("packages")),
    all<StudySession>(tx.objectStore("sessions")),
    all<Mistake>(tx.objectStore("mistakes")),
    reqToPromise(tx.objectStore("meta").get("settings") as IDBRequest<Settings | undefined>),
    reqToPromise(tx.objectStore("meta").get("notifyLog") as IDBRequest<Record<string, string> | undefined>),
    reqToPromise(tx.objectStore("meta").get("seeded") as IDBRequest<boolean | undefined>),
    reqToPromise(tx.objectStore("meta").get("doubts") as IDBRequest<Doubt[] | undefined>),
    reqToPromise(tx.objectStore("meta").get("onboardingDone") as IDBRequest<boolean | undefined>),
    reqToPromise(
      tx.objectStore("meta").get("prepDismissedWeek") as IDBRequest<string | undefined>,
    ),
  ]);
  db.close();
  days.sort((a, b) => a.date.localeCompare(b.date));
  return {
    days,
    packages,
    sessions,
    mistakes: mistakes.map(normalizeMistake),
    settings: mergeSettings(settings),
    notifyLog: notifyLog ?? {},
    seeded: Boolean(seeded),
    onboardingDone: Boolean(onboardingDone),
    doubts: Array.isArray(doubts) ? doubts : [],
    prepDismissedWeek: typeof prepDismissedWeek === "string" ? prepDismissedWeek : "",
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

export async function saveMeta(
  key: "settings" | "notifyLog" | "seeded" | "doubts" | "onboardingDone" | "prepDismissedWeek",
  value: unknown,
): Promise<void> {
  if (key === "settings") {
    // `settings` não carrega mais as chaves (elas têm serviço próprio), mas o
    // fallback web as guarda no mesmo registro. Preservar o campo evita perder
    // a chave se a gravação do serviço falhar depois.
    await updateStoredSettings((current) => {
      const keys = storedKeys(current);
      const next = value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
      if (Object.keys(keys).length) next.keys = keys;
      return next;
    });
    return;
  }
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
 * Chaves de API (fallback web do serviço de armazenamento seguro)
 *
 * No Android o serviço `@/lib/secure/keys` usa o Keystore e estas funções só
 * servem para a migração/apagar o texto puro. Na web elas continuam sendo o
 * armazenamento de hoje (`meta.settings.keys`).
 * ------------------------------------------------------------------ */

function storedKeys(settings: unknown): Record<string, string> {
  if (!settings || typeof settings !== "object") return {};
  const raw = (settings as { keys?: unknown }).keys;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === "string") out[name] = value;
  }
  return out;
}

/** Altera apenas `settings` na store `meta`, numa transação (sem tocar no resto). */
function updateStoredSettings(update: (current: unknown) => unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const finish = () => db.close();
        const tx = db.transaction("meta", "readwrite");
        const store = tx.objectStore("meta");
        const req = store.get("settings");
        req.onsuccess = () => {
          try {
            const next = update(req.result);
            if (next !== undefined) store.put(next, "settings");
          } catch (err) {
            tx.abort();
            finish();
            reject(err instanceof Error ? err : new Error("Falha ao salvar as chaves."));
          }
        };
        req.onerror = () => {
          tx.abort();
          finish();
          reject(req.error ?? new Error("Falha ao ler as chaves salvas."));
        };
        tx.oncomplete = () => {
          finish();
          resolve();
        };
        tx.onerror = () => {
          finish();
          reject(tx.error ?? new Error("Falha ao salvar as chaves."));
        };
        tx.onabort = () => {
          finish();
          reject(tx.error ?? new Error("Gravação das chaves cancelada."));
        };
      }),
  );
}

/** Lê `settings.keys` cru do IndexedDB (usado pelo fallback web e migração). */
export async function readStoredKeys(): Promise<Record<string, string>> {
  const db = await openDb();
  try {
    const settings = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction("meta", "readonly");
      const req = tx.objectStore("meta").get("settings");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Falha ao ler as chaves salvas."));
    });
    return storedKeys(settings);
  } finally {
    db.close();
  }
}

/** Grava/atualiza chaves no fallback web sem perder as demais. */
export async function writeStoredKeys(patch: Record<string, string>): Promise<void> {
  await updateStoredSettings((current) => {
    const base = current && typeof current === "object" ? (current as Record<string, unknown>) : {};
    return { ...base, keys: { ...storedKeys(current), ...patch } };
  });
}

/**
 * Apaga as chaves migradas do IndexedDB. Quando não sobra nenhuma, o campo
 * `keys` sai do objeto de ajustes (nada de texto puro guardado).
 */
export async function removeStoredKeys(names: readonly string[]): Promise<void> {
  await updateStoredSettings((current) => {
    if (!current || typeof current !== "object") return current;
    const next = { ...(current as Record<string, unknown>) };
    const keys = storedKeys(current);
    for (const name of names) delete keys[name];
    if (Object.keys(keys).length) next.keys = keys;
    else delete next.keys;
    return next;
  });
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

/**
 * O esquema/validação/serialização ficam em `backup.ts` (puro, testável);
 * este módulo só lê e grava as stores do IndexedDB.
 */
export { backupSchema, parseBackup, parseBackupText } from "@/lib/study/backup";
export type { BackupFile, FullBackup } from "@/lib/study/backup";

function mergeSettings(raw: unknown): Settings {
  const source: Partial<Settings> & { keys?: unknown } =
    raw && typeof raw === "object" ? (raw as Partial<Settings> & { keys?: unknown }) : {};
  // Chaves nunca fazem parte dos ajustes persistidos: quem cuida delas é
  // `@/lib/secure/keys` (Keystore no Android, IndexedDB na web).
  const { keys: _legacyKeys, ...rest } = source;
  const alerts = rest.alerts && typeof rest.alerts === "object" ? rest.alerts : {};
  const researcher =
    rest.researcher === "grok" ||
    rest.researcher === "perplexity" ||
    rest.researcher === "gemini" ||
    rest.researcher === "claude"
      ? rest.researcher
      : EMPTY_SETTINGS.researcher;
  return {
    ...EMPTY_SETTINGS,
    ...rest,
    researcher,
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
    // O backup nunca leva chaves de API: `buildBackupFile` remove o campo
    // `keys` do topo e da cópia de `settings` dentro de `meta`.
    return buildBackupFile({
      days,
      packages,
      sessions,
      mistakes,
      settings: mergeSettings(meta.settings),
      doubts: Array.isArray(meta.doubts) ? (meta.doubts as Doubt[]) : [],
      meta,
    });
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
