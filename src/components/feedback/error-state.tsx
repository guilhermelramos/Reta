import { cn } from "@/lib/cn";
import type { ErrorCopy } from "@/lib/feedback/error-copy";
import { FeedbackActionButton, type FeedbackActionHandler } from "./feedback-action-button";
import { FeedbackIcon } from "./feedback-icon";

/**
 * Estado de erro de tela/cartão cheio: ícone de 48dp, título, uma frase, ação
 * primária grande (48dp) e link secundário opcional.
 */
export function ErrorState({
  copy,
  onAction,
  className,
}: {
  copy: ErrorCopy;
  onAction?: FeedbackActionHandler;
  className?: string;
}) {
  // O mesmo cartão serve de estado vazio ("nada aqui ainda"): sem o vermelho
  // de erro e com o ícone na cor da marca.
  const empty = copy.kind === "empty";
  return (
    <section
      role={empty ? "status" : "alert"}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-clay/40 bg-surface px-5 py-7 text-center",
        empty && "border-border",
        className,
      )}
    >
      <FeedbackIcon
        kind={copy.kind}
        className={cn("size-12", empty ? "text-primary" : "text-clay-text")}
      />
      <h2 className="text-2xl">{copy.title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-muted">{copy.message}</p>
      {copy.detail ? (
        <p className="max-w-md text-xs leading-relaxed text-muted">{copy.detail}</p>
      ) : null}
      {copy.action || copy.secondaryAction ? (
        <div className="mt-1 flex w-full flex-col items-center gap-2">
          {copy.action ? (
            <FeedbackActionButton
              action={copy.action}
              onAction={onAction}
              emphasis="primary"
              className="w-full sm:w-auto"
            />
          ) : null}
          {copy.secondaryAction ? (
            <FeedbackActionButton
              action={copy.secondaryAction}
              onAction={onAction}
              emphasis="surface"
              className="border-transparent bg-transparent px-2 underline hover:bg-transparent"
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
