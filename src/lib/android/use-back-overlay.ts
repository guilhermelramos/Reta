import { useEffect, useRef } from "react";
import { pushBackOverlay } from "@/lib/android/back-overlays";

/**
 * Registra um overlay (gaveta vaul, diálogo Radix, visualizador próprio)
 * enquanto ele está aberto. Com `open === false` não faz nada.
 *
 * O `onClose` fica numa ref para o registro não ser refeito a cada render e
 * para o handler nativo sempre chamar o callback mais recente.
 */
export function useBackOverlay(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    return pushBackOverlay(() => closeRef.current());
  }, [open]);
}
