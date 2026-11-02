import { Capacitor } from "@capacitor/core";

/**
 * Chaves de API (xAI e outros pesquisadores).
 *
 * O IndexedDB é a fonte de verdade só na web. No Android o app roda dentro do
 * WebView do Capacitor e as chaves vão para o `@aparajita/capacitor-secure-storage`
 * (AES-GCM com chave gerada pelo Android Keystore, em SharedPreferences do app).
 *
 * Fallback web: o navegador não expõe um cofre equivalente ao Keystore. Para não
 * mudar o comportamento atual, `settings.keys` continua no IndexedDB — o mesmo
 * armazenamento de antes. O backup nunca leva essas chaves (ver `db.exportAll`).
 */

export const KEY_NAMES = ["xai", "perplexity", "gemini", "claude"] as const;

export type KeyName = (typeof KEY_NAMES)[number];

export type KeyValues = Record<KeyName, string>;

export const EMPTY_KEYS: KeyValues = { xai: "", perplexity: "", gemini: "", claude: "" };

/** Prefixo das chaves dentro do plugin (o plugin também aplica o prefixo dele). */
const SECURE_PREFIX = "reta.";

/** Contrato mínimo de um cofre de chaves. */
export type KeyStorage = {
  get(name: KeyName): Promise<string | null>;
  set(name: KeyName, value: string): Promise<void>;
  remove(name: KeyName): Promise<void>;
};

/** Onde as chaves antigas ficavam: `settings.keys` no IndexedDB. */
export type LegacyKeyStorage = {
  read(): Promise<Partial<Record<KeyName, unknown>>>;
  remove(names: readonly KeyName[]): Promise<void>;
};

/** Lê valores de chave tolerando registros antigos/corrompidos. */
export function normalizeKeys(raw: unknown): KeyValues {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: KeyValues = { ...EMPTY_KEYS };
  for (const name of KEY_NAMES) {
    const value = source[name];
    out[name] = typeof value === "string" ? value.trim() : "";
  }
  return out;
}

/**
 * Migração idempotente: copia `settings.keys` para o cofre e só depois apaga o
 * valor antigo do IndexedDB. Se o cofre já tiver a chave, ela é preservada (o
 * valor antigo apenas deixa de existir). Um erro no cofre interrompe a função
 * antes da limpeza, então nenhuma chave é perdida.
 */
export async function migrateLegacyKeys(
  secure: KeyStorage,
  legacy: LegacyKeyStorage,
  names: readonly KeyName[] = KEY_NAMES,
): Promise<KeyName[]> {
  const raw = await legacy.read();
  const oldKeys = normalizeKeys(raw);
  const taken: KeyName[] = [];
  for (const name of names) {
    const value = oldKeys[name];
    if (!value) continue;
    const current = await secure.get(name);
    if (!current || !current.trim()) await secure.set(name, value);
    taken.push(name);
  }
  // Apaga do IndexedDB todas as chaves antigas que existiam, inclusive as
  // vazias: o campo `settings.keys` deixa de ser fonte de verdade.
  const stale = names.filter((name) => Object.prototype.hasOwnProperty.call(raw, name));
  if (stale.length) await legacy.remove(stale);
  return taken;
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function secureName(name: KeyName): string {
  return `${SECURE_PREFIX}${name}`;
}

/** Cofre Android (Keystore). O import é tardio para a web não carregar o plugin. */
function nativeStorage(): KeyStorage {
  return {
    async get(name) {
      const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
      const value = await SecureStorage.get(secureName(name));
      return typeof value === "string" ? value : null;
    },
    async set(name, value) {
      const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
      await SecureStorage.set(secureName(name), value);
    },
    async remove(name) {
      const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
      await SecureStorage.remove(secureName(name));
    },
  };
}

/** Fallback web: exatamente o `settings.keys` do IndexedDB de antes. */
const webStorage: KeyStorage = {
  async get(name) {
    const { readStoredKeys } = await import("@/lib/study/db");
    const keys = await readStoredKeys();
    return typeof keys[name] === "string" ? keys[name] : null;
  },
  async set(name, value) {
    const { writeStoredKeys } = await import("@/lib/study/db");
    await writeStoredKeys({ [name]: value });
  },
  async remove(name) {
    const { writeStoredKeys } = await import("@/lib/study/db");
    await writeStoredKeys({ [name]: "" });
  },
};

const legacyStorage: LegacyKeyStorage = {
  async read() {
    const { readStoredKeys } = await import("@/lib/study/db");
    return readStoredKeys();
  },
  async remove(names) {
    const { removeStoredKeys } = await import("@/lib/study/db");
    await removeStoredKeys(names);
  },
};

/**
 * Lê uma chave tolerando cofre corrompido.
 *
 * No Android o valor é decifrado com a chave do Keystore. Depois de um restore
 * de backup do sistema (ou de uma troca de chave do Keystore), o registro pode
 * existir mas a decifragem falhar. Nesse caso a entrada é inútil e ainda
 * derrubaria a inicialização: apagamos o registro e tratamos como "Não
 * configurada", exatamente como se a pessoa nunca tivesse salvo a chave.
 */
export async function readKey(
  storage: KeyStorage,
  name: KeyName,
): Promise<{ value: string; recovered: boolean }> {
  try {
    const value = await storage.get(name);
    return { value: typeof value === "string" ? value.trim() : "", recovered: false };
  } catch {
    try {
      await storage.remove(name);
    } catch {
      // Cofre indisponível: a leitura vazia já evita travar o app.
    }
    return { value: "", recovered: true };
  }
}

async function readAll(storage: KeyStorage): Promise<KeyValues> {
  const out: KeyValues = { ...EMPTY_KEYS };
  for (const name of KEY_NAMES) {
    out[name] = (await readKey(storage, name)).value;
  }
  return out;
}

function activeStorage(): KeyStorage {
  return isNative() ? nativeStorage() : webStorage;
}

/** Lê uma chave do cofre ativo (Android: Keystore; web: IndexedDB). */
export async function getKey(name: KeyName): Promise<string> {
  return (await readKey(activeStorage(), name)).value;
}

/** Lê todas as chaves do cofre ativo. */
export async function getKeys(): Promise<KeyValues> {
  return readAll(activeStorage());
}

/** Grava (ou apaga, quando vazia) uma chave no cofre ativo. */
export async function setKey(name: KeyName, value: string): Promise<void> {
  const clean = value.trim();
  const storage = activeStorage();
  if (clean) await storage.set(name, clean);
  else await storage.remove(name);
}

/** Grava o conjunto inteiro de chaves (as ausentes viram vazio). */
export async function setKeys(values: Partial<KeyValues>): Promise<void> {
  for (const name of KEY_NAMES) await setKey(name, values[name] ?? "");
}

/** Remove uma chave do cofre ativo. */
export async function removeKey(name: KeyName): Promise<void> {
  await activeStorage().remove(name);
}

/**
 * Inicialização: no Android migra `settings.keys` (uma única vez; idempotente)
 * e passa a ler do Keystore. Na web lê o IndexedDB como sempre. Se o plugin
 * nativo estiver indisponível, devolve as chaves antigas desta execução e tenta
 * migrar de novo na próxima abertura — nenhuma chave é descartada.
 */
export async function loadKeys(): Promise<KeyValues> {
  if (!isNative()) return readAll(webStorage);
  try {
    await migrateLegacyKeys(nativeStorage(), legacyStorage);
    return await readAll(nativeStorage());
  } catch {
    // A migração pode falhar justamente porque uma entrada do Keystore está
    // corrompida. `readAll` tenta cada chave de novo e apaga só as inválidas,
    // então uma chave boa não é perdida por causa de outra.
    const recovered = await readAll(nativeStorage());
    if (KEY_NAMES.some((name) => recovered[name])) return recovered;
    // Cofre realmente indisponível: mantém as chaves antigas desta execução.
    return normalizeKeys(await legacyStorage.read());
  }
}
