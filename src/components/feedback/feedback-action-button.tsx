import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { FeedbackAction } from "@/lib/feedback/error-copy";
import { cn } from "@/lib/cn";
import { useRetryCountdown } from "./use-retry-countdown";

export type FeedbackActionHandler = (action: FeedbackAction) => void;

/**
 * Botão/link de uma ação de erro. Ações de retry respeitam o `Retry-After`
 * (429) com contagem regressiva; rotas internas usam o `Link` do roteador.
 */
export function FeedbackActionButton({
  action,
  onAction,
  emphasis = "primary",
  className,
}: {
  action: FeedbackAction;
  onAction?: FeedbackActionHandler;
  emphasis?: "primary" | "surface";
  className?: string;
}) {
  const left = useRetryCountdown(
    action.id === "retry" ? action.retryAfterSeconds : undefined,
  );
  const label = left > 0 ? `${action.label} em ${left} s` : action.label;
  const look = cn(emphasis === "primary" ? "min-h-12 px-5" : "min-h-12", className);

  if (action.href) {
    return (
      <Button asChild variant={emphasis === "primary" ? "primary" : "surface"} className={look}>
        <Link to={action.href}>{label}</Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={emphasis === "primary" ? "primary" : "surface"}
      className={look}
      disabled={left > 0}
      onClick={() => onAction?.(action)}
    >
      {label}
    </Button>
  );
}
