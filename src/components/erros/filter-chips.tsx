import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  hasActiveFilters,
  NOTEBOOK_STATUSES,
  NOTEBOOK_STATUS_LABEL,
  type NotebookFilters,
} from "@/lib/study/error-notebook";
import { ERROR_REASON_LABEL } from "@/lib/study/types";
import type { ErrorReason } from "@/lib/study/types";

/**
 * Filtros do caderno em uma única linha rolável: status, matéria e motivo.
 * Cada chip tem 32dp de altura visual dentro de um alvo de toque de 48dp,
 * como o FilterChip do M3; "Limpar" aparece sempre que algo foge do padrão.
 */
export function NotebookFilterChips({
  filters,
  subjects,
  reasons,
  onChange,
  onClear,
}: {
  filters: NotebookFilters;
  subjects: readonly string[];
  reasons: readonly ErrorReason[];
  onChange: (filters: NotebookFilters) => void;
  onClear: () => void;
}) {
  const active = hasActiveFilters(filters);

  return (
    <div className="notebook-chips" role="group" aria-label="Filtros do caderno de erros">
      {active ? (
        <button
          type="button"
          onClick={onClear}
          className="notebook-chip"
          aria-label="Limpar filtros"
        >
          <span className="notebook-chip-visual border-transparent text-primary">
            <X className="size-3.5" aria-hidden />
            Limpar
          </span>
        </button>
      ) : null}

      {NOTEBOOK_STATUSES.map((status) => (
        <FilterChip
          key={status}
          label={NOTEBOOK_STATUS_LABEL[status]}
          ariaLabel={`Status: ${NOTEBOOK_STATUS_LABEL[status]}`}
          active={filters.status === status}
          onClick={() => onChange({ ...filters, status })}
        />
      ))}

      {subjects.length || reasons.length ? <Divider /> : null}

      {subjects.map((subject) => (
        <FilterChip
          key={`subject-${subject}`}
          label={subject}
          ariaLabel={`Matéria: ${subject}`}
          active={filters.subject === subject}
          onClick={() =>
            onChange({
              ...filters,
              subject: filters.subject === subject ? null : subject,
            })
          }
        />
      ))}

      {reasons.length ? <Divider /> : null}

      {reasons.map((reason) => (
        <FilterChip
          key={`reason-${reason}`}
          label={ERROR_REASON_LABEL[reason]}
          ariaLabel={`Motivo: ${ERROR_REASON_LABEL[reason]}`}
          active={filters.reason === reason}
          onClick={() =>
            onChange({
              ...filters,
              reason: filters.reason === reason ? null : reason,
            })
          }
        />
      ))}
    </div>
  );
}

function FilterChip({
  label,
  ariaLabel,
  active,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className="notebook-chip"
    >
      <span className={cn("notebook-chip-visual", active && "chip-active")}>{label}</span>
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="h-6 w-px shrink-0 self-center bg-border" />;
}
