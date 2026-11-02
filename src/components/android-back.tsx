import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { decideBackAction, isEditableTarget } from "@/lib/android/back-navigation";
import { closeTopBackOverlay, hasBackOverlay } from "@/lib/android/back-overlays";

/**
 * Campo de texto focado com o teclado aberto. O Android entrega o `backButton`
 * ao WebView mesmo com o IME visível em algumas versões; nesse caso o primeiro
 * voltar deve só fechar o teclado, sem fechar o sheet do Professor nem navegar.
 */
function focusedTextField(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  const input = active as HTMLElement & {
    type?: string;
    readOnly?: boolean;
    disabled?: boolean;
  };
  return isEditableTarget({
    tagName: input.tagName,
    type: input.type,
    isContentEditable: input.isContentEditable,
    readOnly: input.readOnly,
    disabled: input.disabled,
  })
    ? active
    : null;
}

/**
 * Botão/gesto "voltar" do Android (Capacitor).
 *
 * Montado no layout do app, mas só faz algo no nativo Android: na web o
 * navegador já cuida do botão voltar e o listener do plugin não existe.
 * Nada é renderizado.
 */
export function AndroidBackHandler(): null {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let removeListener: (() => void) | undefined;

    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (cancelled || Capacitor.getPlatform() !== "android") return;

      const { App } = await import("@capacitor/app");
      const listener = await App.addListener("backButton", () => {
        const field = focusedTextField();
        const action = decideBackAction({
          keyboardOpen: field != null,
          overlayOpen: hasBackOverlay(),
          canGoBack: router.history.canGoBack(),
          pathname: router.state.location.pathname,
        });

        if (action === "blur-field") {
          field?.blur();
          return;
        }
        if (action === "close-overlay") {
          closeTopBackOverlay();
          return;
        }
        if (action === "history-back") {
          router.history.back();
          return;
        }
        if (action === "navigate-home") {
          void router.navigate({ to: "/" });
          return;
        }
        // Hoje sem histórico: minimiza (o sistema pode matar o app depois; a
        // sessão ativa já está salva no IndexedDB e retoma pelo horário real).
        void App.minimizeApp().catch(() => undefined);
      });

      if (cancelled) {
        void listener.remove();
        return;
      }
      removeListener = () => {
        void listener.remove();
      };
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [router]);

  return null;
}
