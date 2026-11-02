import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { useBackOverlay } from "@/lib/android/use-back-overlay";

/**
 * Diálogo de confirmação M3 para ações destrutivas.
 *
 * `role="alertdialog"` anuncia o título e a consequência antes dos botões. O
 * Radix prende o foco dentro do diálogo, fecha com Esc e devolve o foco ao
 * gatilho; o `useBackOverlay` faz o mesmo com o botão/gesto voltar do Android.
 * A ação que destrói fica na cor de erro e a saída segura é "Cancelar".
 * Usado pelos Ajustes e pelo caderno de erros.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useBackOverlay(open, onCancel);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <DialogPrimitive.Content
          role="alertdialog"
          aria-modal="true"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-border bg-surface p-6 shadow-2xl outline-none"
        >
          <DialogPrimitive.Title className="text-2xl">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-base leading-relaxed text-muted">
            {description}
          </DialogPrimitive.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
