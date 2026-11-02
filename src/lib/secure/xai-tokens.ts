/**
 * Tokens do login experimental da conta xAI.
 *
 * Regra de segurança: os tokens **nunca** vão para o IndexedDB, para o bundle,
 * para logs ou para o backup `.json`. No Android ficam no mesmo cofre seguro
 * das chaves (Android Keystore, via `@aparajita/capacitor-secure-storage`),
 * excluído do backup pelo `allowBackup="false"` e pelas regras de
 * `android/app/src/main/res/xml/`.
 *
 * Na web não existe Keystore: usamos `sessionStorage` (some ao fechar a aba e
 * nunca entra no backup) e, se o navegador bloquear, memória da página.
 */

import { Capacitor } from "@capacitor/core";
import { parseStoredTokens, type XaiTokens } from "../ai/xai-auth/device.ts";

/** Nome próprio no cofre, ao lado de `reta.xai`/`reta.openrouter`. */
const STORAGE_NAME = "reta.xai.oauth";
/** Chave da sessão web; não é IndexedDB, então não entra em `exportAll`. */
const SESSION_KEY = "reta.xai.oauth";

export function serializeXaiTokens(tokens: XaiTokens): string {
  return JSON.stringify(tokens);
}

/** Memória da página como último recurso (navegador sem sessionStorage). */
let memoryValue: string | null = null;

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function nativeRead(): Promise<string | null> {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  const value = await SecureStorage.get(STORAGE_NAME);
  return typeof value === "string" ? value : null;
}

async function nativeWrite(value: string): Promise<void> {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  await SecureStorage.set(STORAGE_NAME, value);
}

async function nativeClear(): Promise<void> {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  await SecureStorage.remove(STORAGE_NAME);
}

function webRead(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return memoryValue;
  }
}

function webWrite(value: string): void {
  memoryValue = value;
  try {
    window.sessionStorage.setItem(SESSION_KEY, value);
  } catch {
    // Modo privado: a memória da página mantém a sessão até recarregar.
  }
}

function webClear(): void {
  memoryValue = null;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nada a limpar.
  }
}

/** Lê e valida os tokens do cofre ativo. Cofre corrompido = desconectado. */
export async function loadXaiTokens(): Promise<XaiTokens | null> {
  let raw: string | null = null;
  try {
    raw = isNative() ? await nativeRead() : webRead();
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return parseStoredTokens(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/** Grava os tokens somente no cofre seguro/sessão. */
export async function saveXaiTokens(tokens: XaiTokens): Promise<void> {
  const value = serializeXaiTokens(tokens);
  if (isNative()) await nativeWrite(value);
  else webWrite(value);
}

/** Remove o login deste aparelho. */
export async function clearXaiTokens(): Promise<void> {
  if (isNative()) {
    try {
      await nativeClear();
    } catch {
      // Plugin indisponível: não há token a apagar.
    }
    return;
  }
  webClear();
}
