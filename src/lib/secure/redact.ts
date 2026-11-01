/**
 * Remove o campo `keys` de um objeto de ajustes.
 *
 * Fica num módulo puro (sem IndexedDB, sem Capacitor) para o backup e os testes
 * compartilharem exatamente a mesma regra: chave de API nunca vai para arquivo.
 */
export function withoutKeys<T extends object>(settings: T): Omit<T, "keys"> {
  const { keys: _keys, ...rest } = settings as T & { keys?: unknown };
  return rest;
}
