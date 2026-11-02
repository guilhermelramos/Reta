/**
 * Modo foco pedido por uma tela (ex.: revisão de erros).
 *
 * A sessão esconde a navegação pelo caminho da rota; fluxos que acontecem
 * dentro da mesma rota (a revisão um a um) usam este singleton para pedir o
 * mesmo layout imersivo sem inventar uma rota nova.
 */
let focused = false;
const listeners = new Set<() => void>();

export function getPageFocus(): boolean {
  return focused;
}

export function setPageFocus(next: boolean): void {
  if (focused === next) return;
  focused = next;
  for (const listener of listeners) listener();
}

export function subscribePageFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
