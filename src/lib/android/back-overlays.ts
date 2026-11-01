/**
 * Pilha de overlays que capturam o "voltar" do Android.
 *
 * Gavetas (vaul), diálogos (Radix) e overlays próprios se registram enquanto
 * estão abertos. O handler nativo fecha sempre o mais recente e só depois
 * considera o histórico do roteador — sem `history.back()` pelas costas de um
 * diálogo aberto.
 *
 * É um singleton de módulo (fora do React) porque o handler nativo precisa do
 * estado mais atual no instante do evento, sem depender de re-render.
 */
type BackOverlay = {
  id: number;
  close: () => void;
};

const stack: BackOverlay[] = [];
let nextId = 1;

/** Registra um overlay aberto. A função devolvida remove o registro. */
export function pushBackOverlay(close: () => void): () => void {
  const overlay: BackOverlay = { id: nextId, close };
  nextId += 1;
  stack.push(overlay);
  return () => {
    const index = stack.findIndex((item) => item.id === overlay.id);
    if (index >= 0) stack.splice(index, 1);
  };
}

export function hasBackOverlay(): boolean {
  return stack.length > 0;
}

/**
 * Fecha o overlay mais recente. Remove da pilha antes de chamar `close()`
 * para o cleanup do React não tentar remover duas vezes.
 */
export function closeTopBackOverlay(): boolean {
  const top = stack.pop();
  if (!top) return false;
  top.close();
  return true;
}

/** Só para testes: limpa a pilha entre cenários. */
export function resetBackOverlays(): void {
  stack.length = 0;
  nextId = 1;
}
