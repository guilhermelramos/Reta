/**
 * Geometria do menu de overflow (⋮) da tela Hoje.
 *
 * O botão fica alinhado ao topo do cabeçalho, mas o título serifado pode
 * ocupar duas ou três linhas em 320–360px. Ancorar o menu apenas na base do
 * botão faria o popover cobrir o H1; o deslocamento cresce até a base do
 * bloco de texto do cabeçalho.
 */

/** Folga entre a base do cabeçalho e o topo do menu. */
export const MENU_GAP = 8;

/**
 * Distância vertical entre a base do botão ⋮ e o topo do menu.
 *
 * Devolve `MENU_GAP` quando o cabeçalho termina antes do botão (ou quando a
 * medição não está disponível); caso contrário, soma o que falta para o menu
 * começar abaixo do bloco de texto. Arredonda para cima para não encostar no
 * título por causa de subpixel.
 */
export function menuSideOffset(triggerBottom: number, contentBottom: number): number {
  if (!Number.isFinite(triggerBottom) || !Number.isFinite(contentBottom)) {
    return MENU_GAP;
  }
  return Math.max(MENU_GAP, Math.ceil(contentBottom - triggerBottom + MENU_GAP));
}
