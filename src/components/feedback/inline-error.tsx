import { cn } from "@/lib/cn";
import type { ErrorCopy } from "@/lib/feedback/error-copy";
import { FeedbackActionButton, type FeedbackActionHandler } from "./feedback-action-button";
import { FeedbackIcon } from "./feedback-icon";

/**
 * Banner de erro dentro de um cartão: ícone, uma frase e (no máximo) uma ação.
 * Usa só os tokens do tema (`clay`, `surface`, `border`, `muted`).
 */
export function InlineError({
  copy,
  onAction,
  className,
}: {
  copy: ErrorCopy;
  onAction?: FeedbackActionHandler;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-clay/40 bg-clay/10 px-3 py-2.5",
        className,
      )}
    >
      <FeedbackIcon kind={copy.kind} className="mt-0.5 size-5 shrink-0 text-clay-text" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-fg">{copy.message}</p>
        {copy.detail ? (
          <p className="mt-1 text-xs leading-relaxed text-muted">{copy.detail}</p>
        ) : null}
        {copy.action ? (
          <FeedbackActionButton
            action={copy.action}
            onAction={onAction}
            emphasis="surface"
            className="mt-2"
          />
        ) : null}
      </div>
    </div>
  );
}
