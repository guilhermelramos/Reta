/**
 * Armazenamento persistente do IndexedDB.
 *
 * No Android o WebView e os navegadores podem descartar os dados do app quando
 * o aparelho fica sem espaço. `navigator.storage.persist()` pede ao sistema
 * para não fazer isso. A chamada é silenciosa e idempotente: feita ao gravar o
 * plano, importar uma planilha ou salvar a chave, nunca bloqueia a ação e não
 * vira um botão obrigatório para a pessoa.
 *
 * O contrato mínimo (`persisted`/`persist`) deixa a lógica pura e testável em
 * Node, sem `navigator` nem IndexedDB.
 */

export type PersistStorage = {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
};

/** Só vale pedir quando a API existe e o navegador ainda não concedeu. */
export function shouldRequestPersist(
  storage: PersistStorage | null | undefined,
  persisted: boolean | null,
): boolean {
  if (!storage || typeof storage.persist !== "function") return false;
  return persisted !== true;
}

function browserStorage(): PersistStorage | null {
  if (typeof navigator === "undefined") return null;
  return (navigator.storage as PersistStorage | undefined) ?? null;
}

/**
 * Pede o armazenamento persistente quando necessário. Devolve `true` só se o
 * estado final for persistente; qualquer erro/ausência da API vira `false`
 * (o backup manual continua sendo a proteção).
 */
export async function ensurePersistentStorage(
  storage: PersistStorage | null = browserStorage(),
): Promise<boolean> {
  if (!storage) return false;
  try {
    const already =
      typeof storage.persisted === "function" ? await storage.persisted().catch(() => null) : null;
    if (!shouldRequestPersist(storage, already)) return already === true;
    return await storage.persist!()
      .then(Boolean)
      .catch(() => false);
  } catch {
    return false;
  }
}
