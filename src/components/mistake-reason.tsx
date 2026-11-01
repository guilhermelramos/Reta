import { cn } from "@/lib/cn";
import { ERROR_REASON_LABEL } from "@/lib/study/types";
import type { ErrorReason } from "@/lib/study/types";

const REASONS: ErrorReason[] = ["lacuna_teorica", "atencao", "interpretacao", "tempo"];

type Props = {
  value?: ErrorReason;
  onChange: (reason: ErrorReason) => void;
  label?: string;
  className?: string;
};

/** Chips de classificação rápida da causa do erro. */
export function ErrorReasonPicker({
  value,
  onChange,
  label = "Por que você errou?",
  className,
}: Props) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-xs text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {REASONS.map((reason) => {
          const active = value === reason;
          return (
            <button
              key={reason}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(reason)}
              className={cn(
                "min-h-12 rounded-full border px-3 text-xs transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted hover:border-primary/50 hover:text-fg",
              )}
            >
              {ERROR_REASON_LABEL[reason]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
