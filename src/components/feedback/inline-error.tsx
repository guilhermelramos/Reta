import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ErrorCopy, FeedbackAction } from "@/lib/feedback/error-copy";
import { FeedbackActionButton, type FeedbackActionHandler } from "./feedback-action-button";
import { FeedbackIcon } from "./feedback-icon";

/**
 * Banner de erro dentro de um cartão: ícone, uma frase e as ações de saída.
 * Usa só os tokens do tema (`clay`, `surface`, `border`, `muted`).
 *
 * `secondaryAction` é uma saída alternativa (ex.: "Baixar modelo" ao lado de
 * "Escolher outro arquivo") sem precisar repetir o texto do erro.
 */
export function InlineError({
  copy,
  onAction,
  secondaryAction,
  children,
  className,
}: {
  copy: ErrorCopy;
  onAction?: FeedbackActionHandler;
  secondaryAction?: FeedbackAction;
  /** Conteúdo extra abaixo da frase (ex.: linhas com problema na planilha). */
  children?: ReactNode;
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
        {children}
        {copy.action || secondaryAction ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {copy.action ? (
              <FeedbackActionButton action={copy.action} onAction={onAction} emphasis="surface" />
            ) : null}
            {secondaryAction ? (
              <FeedbackActionButton
                action={secondaryAction}
                onAction={onAction}
                emphasis="surface"
                className="border-transparent bg-transparent px-2 underline hover:bg-transparent"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
