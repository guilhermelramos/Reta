/**
 * Regras puras da folha do Professor (chips e barra de entrada).
 *
 * Ficam fora do componente para serem testadas com `node --test` e para que a
 * conversa salva (dúvidas do IndexedDB) decida a UI sem estado paralelo.
 */

/**
 * As perguntas de 1 toque só aparecem enquanto a conversa está vazia: depois
 * da primeira mensagem enviada elas somem e liberam altura para a resposta.
 */
export function quickQuestionsVisible(sentCount: number): boolean {
  const count = Number.isFinite(sentCount) ? Math.max(0, Math.floor(sentCount)) : 0;
  return count === 0;
}

/** O envio é um IconButton desabilitado enquanto o campo está vazio ou ocupado. */
export function canSendMessage(draft: string, busy: boolean): boolean {
  if (busy) return false;
  return draft.trim().length > 0;
}
