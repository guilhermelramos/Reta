import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Snackbar M3: mensagem curta de uma linha, ação opcional e saída automática.
 *
 * O timer de saída não reinicia a cada render (a sessão repinta o cronômetro
 * a cada segundo); cada mensagem nova reinicia a contagem.
 */
export function Snackbar({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 6000,
  className,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
  className?: string;
}) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const timer = window.setTimeout(() => dismissRef.current(), durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-4 bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))] z-50 mx-auto flex min-h-14 max-w-md items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2 text-fg shadow-lg",
        className,
      )}
    >
      <p className="min-w-0 flex-1 text-sm leading-snug">{message}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          className="min-h-12 shrink-0 px-2 text-sm font-semibold text-primary"
          onClick={() => {
            onAction();
            dismissRef.current();
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
