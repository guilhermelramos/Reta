import { useEffect, useSyncExternalStore } from "react";
import { getPageFocus, setPageFocus, subscribePageFocus } from "@/lib/ui/page-focus";

/**
 * Registra o modo foco enquanto `active` for verdadeiro. O cleanup devolve a
 * navegação assim que a tela/estado sai (ou ao desmontar a rota).
 */
export function usePageFocus(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    setPageFocus(true);
    return () => setPageFocus(false);
  }, [active]);
}

/** Lido pelo shell para decidir se NavigationBar e NavigationRail somem. */
export function usePageFocusActive(): boolean {
  return useSyncExternalStore(subscribePageFocus, getPageFocus, () => false);
}
