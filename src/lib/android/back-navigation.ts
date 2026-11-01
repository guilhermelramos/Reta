/**
 * Decisão do botão/gesto "voltar" do Android.
 *
 * A função é pura de propósito: o handler nativo só coleta o estado atual
 * (overlay aberto? histórico disponível? rota atual?) e executa a ação.
 * Assim o comportamento pode ser testado sem WebView, plugin ou roteador.
 */
export type BackAction = "close-overlay" | "history-back" | "navigate-home" | "minimize";

export type BackState = {
  /** Existe gaveta/sheet/diálogo aberto na pilha de overlays? */
  overlayOpen: boolean;
  /** O histórico do roteador tem uma entrada anterior (router.history.canGoBack()). */
  canGoBack: boolean;
  /** Rota atual (`router.state.location.pathname`). */
  pathname: string;
};

/**
 * "Hoje" é a raiz do app. No Capacitor a URL inicial é `https://localhost/`,
 * mas o shell estático também pode ser servido como `/index.html`.
 */
export function isHomePath(pathname: string): boolean {
  const path = (pathname.split(/[?#]/, 1)[0] ?? "").replace(/\/+$/, "");
  return path === "" || path === "/" || path === "/index.html" || path === "/index.htm";
}

/**
 * Ordem do "voltar":
 *
 * 1. overlay aberto → fecha o mais recente (não sai da tela por baixo);
 * 2. histórico disponível → volta uma entrada;
 * 3. em Hoje (sem histórico) → minimiza em vez de fechar o app;
 * 4. outra rota sem histórico (link direto/deep link) → vai para Hoje,
 *    em vez de deixar o usuário sem saída a não ser fechar o app.
 */
export function decideBackAction(state: BackState): BackAction {
  if (state.overlayOpen) return "close-overlay";
  if (state.canGoBack) return "history-back";
  if (isHomePath(state.pathname)) return "minimize";
  return "navigate-home";
}
