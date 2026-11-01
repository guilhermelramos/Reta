import { z } from "zod";
import { withoutKeys } from "../secure/redact.ts";
import type { Doubt, Mistake, PlanDay, Settings, StudyPackage, StudySession } from "./types.ts";

/**
 * Backup completo do Reta.
 *
 * Este módulo é puro (não toca em IndexedDB) para poder ser testado com
 * `node --test`. A leitura/gravação das stores fica em `db.ts`.
 *
 * Regra de segurança: as chaves de API são segredos do aparelho e **nunca**
 * entram no arquivo de backup. O que é exportado é só o dado de estudo.
 */

export const BACKUP_FORMAT_VERSION = 1;

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
  /**
   * Aceito na leitura por compatibilidade com backups antigos, mas nunca
   * escrito: `serializeBackup`/`buildBackupFile` removem as chaves.
   */
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

export type BackupSnapshot = {
  days: PlanDay[];
  packages: StudyPackage[];
  sessions: StudySession[];
  mistakes: Mistake[];
  settings: Settings;
  doubts: Doubt[];
  meta: Record<string, unknown>;
  exportedAt?: string;
};

/** Valida o JSON lido do arquivo. Lança `ZodError` quando o formato não bate. */
export function parseBackup(raw: unknown): BackupFile {
  return backupSchema.parse(raw);
}

/**
 * Lê e valida o texto do arquivo. `JSON.parse` lança `SyntaxError` para
 * arquivo vazio ou corrompido; o esquema lança `ZodError` para JSON válido
 * com formato errado. Quem chama trata os dois casos com mensagens distintas.
 */
export function parseBackupText(text: string): BackupFile {
  if (!text.trim()) throw new SyntaxError("O arquivo está vazio.");
  return parseBackup(JSON.parse(text) as unknown);
}

/**
 * Uma cópia dos ajustes sem nenhuma chave de API.
 *
 * As chaves saíram de `Settings` no serviço seguro (Keystore/IndexedDB
 * separado), mas backups e registros antigos ainda podem trazer `keys`; o
 * campo é removido aqui para nunca voltar ao arquivo.
 */
export function redactSettings(settings: Settings): Settings {
  return withoutKeys(settings);
}

/**
 * Remove qualquer chave de API que tenha sobrado no retrato (defesa em
 * profundidade: `meta.settings` é uma cópia dos ajustes).
 */
export function redactBackup(backup: FullBackup): FullBackup {
  const settings = redactSettings(backup.settings);
  const meta: Record<string, unknown> = { ...backup.meta, settings };
  return { ...backup, settings, meta };
}

/**
 * Monta o backup a partir do retrato das stores. As chaves de API ficam de
 * fora de `settings` e de `meta.settings`.
 */
export function buildBackupFile(snapshot: BackupSnapshot): FullBackup {
  const settings = redactSettings(snapshot.settings);
  return {
    app: "reta",
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: snapshot.exportedAt ?? new Date().toISOString(),
    days: snapshot.days,
    packages: snapshot.packages,
    sessions: snapshot.sessions,
    mistakes: snapshot.mistakes,
    settings,
    doubts: snapshot.doubts,
    meta: { ...snapshot.meta, settings },
  };
}

/** JSON legível (2 espaços) sem nenhuma chave de API. */
export function serializeBackup(backup: FullBackup): string {
  return JSON.stringify(redactBackup(backup), null, 2);
}
