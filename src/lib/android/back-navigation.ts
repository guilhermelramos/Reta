/**
 * Decisão do botão/gesto "voltar" do Android.
 *
 * A função é pura de propósito: o handler nativo só coleta o estado atual
 * (overlay aberto? histórico disponível? rota atual?) e executa a ação.
 * Assim o comportamento pode ser testado sem WebView, plugin ou roteador.
 */
export type BackAction =
  | "blur-field"
  | "close-overlay"
  | "history-back"
  | "navigate-home"
  | "minimize";

export type BackState = {
  /** Há um campo de texto focado com o teclado aberto. */
  keyboardOpen: boolean;
  /** Existe gaveta/sheet/diálogo aberto na pilha de overlays? */
  overlayOpen: boolean;
  /** O histórico do roteador tem uma entrada anterior (router.history.canGoBack()). */
  canGoBack: boolean;
  /** Rota atual (`router.state.location.pathname`). */
  pathname: string;
};

/** O mínimo que o handler nativo precisa ler de um elemento focado. */
export type EditableTarget = {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
};

const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
]);

/**
 * O campo focado abre o teclado? `select`, checkbox, botão e os inputs de
 * data/cor não contam: o primeiro "voltar" neles não deve apenas tirar o foco.
 */
export function isEditableTarget(target: EditableTarget | null): boolean {
  if (!target || target.disabled || target.readOnly) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  return TEXT_INPUT_TYPES.has((target.type ?? "text").toLowerCase());
}

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
 * 0. teclado aberto num campo → só tira o foco (o IME fecha; o sheet e a rota
 *    ficam como estão);
 * 1. overlay aberto → fecha o mais recente (não sai da tela por baixo);
 * 2. histórico disponível → volta uma entrada;
 * 3. em Hoje (sem histórico) → minimiza em vez de fechar o app;
 * 4. outra rota sem histórico (link direto/deep link) → vai para Hoje,
 *    em vez de deixar o usuário sem saída a não ser fechar o app.
 */
export function decideBackAction(state: BackState): BackAction {
  if (state.keyboardOpen) return "blur-field";
  if (state.overlayOpen) return "close-overlay";
  if (state.canGoBack) return "history-back";
  if (isHomePath(state.pathname)) return "minimize";
  return "navigate-home";
}
