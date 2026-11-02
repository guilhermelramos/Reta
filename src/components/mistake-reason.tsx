import { cn } from "@/lib/cn";
import { ERROR_REASON_LABEL } from "@/lib/study/types";
import type { ErrorReason } from "@/lib/study/types";

const REASONS: ErrorReason[] = ["lacuna_teorica", "atencao", "interpretacao", "tempo"];

type Props = {
  value?: ErrorReason;
  onChange: (reason: ErrorReason) => void;
  /** Mostra "Sem motivo" e permite limpar a classificação (opcional). */
  onClear?: () => void;
  allowClear?: boolean;
  label?: string;
  className?: string;
};

/**
 * Chips M3 de classificação rápida da causa do erro: visual de 32dp dentro de
 * um alvo de toque de 48dp. Escolha única; `allowClear` libera o "Sem motivo".
 */
export function ErrorReasonPicker({
  value,
  onChange,
  onClear,
  allowClear = false,
  label = "Por que você errou?",
  className,
}: Props) {
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
      active ? "border-primary bg-primary-tonal text-primary" : "border-border text-muted",
    );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? <p className="text-xs text-muted">{label}</p> : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label || undefined}>
        {REASONS.map((reason) => {
          const active = value === reason;
          return (
            <button
              key={reason}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(reason)}
              className="flex min-h-12 shrink-0 items-center"
            >
              <span className={chip(active)}>{ERROR_REASON_LABEL[reason]}</span>
            </button>
          );
        })}
        {allowClear ? (
          <button
            type="button"
            aria-pressed={!value}
            onClick={() => onClear?.()}
            className="flex min-h-12 shrink-0 items-center"
          >
            <span className={chip(!value)}>Sem motivo</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
