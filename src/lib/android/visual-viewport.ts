import { useEffect } from "react";

/**
 * Altura realmente visível do WebView e espaço coberto pelo teclado.
 *
 * Com `adjustResize` o Android costuma encolher a janela inteira. Alguns
 * aparelhos, porém, redimensionam só a `visualViewport` (ou animam o resize
 * depois do foco); nesses casos `100dvh` continua achando que há espaço atrás
 * do teclado. O sheet do Professor usa estas duas medidas para nunca esconder
 * o cabeçalho quando o campo de texto recebe o foco.
 */
export type ViewportMetrics = {
  /** Altura do layout (janela), em px CSS. */
  layoutHeight: number;
  /** Altura da área visível, em px CSS. */
  visualHeight: number;
  /** Deslocamento do topo da área visível, em px CSS. */
  visualOffsetTop: number;
};

/** Faixa inferior coberta pelo teclado/IME; 0 quando não há sobreposição. */
export function keyboardInset(metrics: ViewportMetrics): number {
  const layout = Math.max(0, metrics.layoutHeight);
  const bottom = Math.max(
    0,
    Math.min(layout, metrics.visualOffsetTop + Math.max(0, metrics.visualHeight)),
  );
  return Math.max(0, Math.round(layout - bottom));
}

/** Altura visível arredondada (o CSS var recebe `px`). */
export function visibleHeight(metrics: ViewportMetrics): number {
  return Math.max(0, Math.round(metrics.visualHeight));
}

function metrics(): ViewportMetrics {
  const viewport = globalThis.window?.visualViewport;
  const layoutHeight = globalThis.window?.innerHeight ?? 0;
  return {
    layoutHeight,
    visualHeight: viewport?.height ?? layoutHeight,
    visualOffsetTop: viewport?.offsetTop ?? 0,
  };
}

/**
 * Publica `--reta-vvh` (altura visível) e `--reta-keyboard-inset` (faixa do
 * teclado) no `<html>`. Os valores são px para poderem ser combinados com
 * `min()`/`calc()` no CSS sem depender de `100dvh` atualizar no WebView.
 */
export function useVisualViewportVars(active = true): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const root = document.documentElement;
    const update = () => {
      const current = metrics();
      root.style.setProperty("--reta-vvh", `${visibleHeight(current)}px`);
      root.style.setProperty("--reta-keyboard-inset", `${keyboardInset(current)}px`);
    };
    update();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      root.style.removeProperty("--reta-vvh");
      root.style.removeProperty("--reta-keyboard-inset");
    };
  }, [active]);
}
