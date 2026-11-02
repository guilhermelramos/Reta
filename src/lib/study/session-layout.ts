/**
 * Decisões de layout da tela Sessão (revisão P4).
 *
 * Ficam fora do componente para serem testadas com `node --test`:
 *
 * - o cartão "Este bloco ainda não tem material rico" é a primeira dobra do
 *   conteúdo e contém o CTA "Gerar material com IA";
 * - o botão do Professor era flutuante e cobria esse CTA em telas de 320px.
 *
 * Com o cartão vazio visível, o botão passa para o fluxo (abaixo do cartão).
 * Sem ele, continua como FAB, já que a lista de subtópicos/aula deixa espaço
 * livre no rodapé (o conteúdo tem 88px de padding inferior reservados).
 */

export type ProfessorPlacement = "inline" | "fab";

/**
 * O cartão de material vazio aparece quando o pacote rico do bloco ainda não
 * está salvo no aparelho e o bloco tem minutos planejados (ou nem existe
 * plano para ele). Espelha a condição de renderização de `GeneratePackage`.
 */
export function materialPlaceholderVisible(input: {
  /** Existe algum pacote salvo para o bloco. */
  hasPackage: boolean;
  /** O pacote tem aula, flashcards e questões (`isRichPackage`). */
  rich: boolean;
  /** Minutos planejados do bloco na planilha. */
  plannedMin: number;
}): boolean {
  if (input.rich) return false;
  return !input.hasPackage || input.plannedMin > 0;
}

/** Com o cartão vazio na primeira dobra, o Professor entra no fluxo abaixo dele. */
export function professorPlacement(placeholderVisible: boolean): ProfessorPlacement {
  return placeholderVisible ? "inline" : "fab";
}
