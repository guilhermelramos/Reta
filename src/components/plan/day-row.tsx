import { CheckCircle2, Circle, CircleDot, Moon } from "lucide-react";
import {
  dayMonth,
  PLAN_DAY_STATE_LABEL,
  planDayState,
  planDayTopics,
  type PlanDayState,
} from "@/lib/study/plan-schedule";
import { formatMin, formatWeekday } from "@/lib/study/time";
import type { PlanDay, StudySession } from "@/lib/study/types";
import { cn } from "@/lib/cn";

const STATE_ICON: Record<PlanDayState, typeof CheckCircle2> = {
  feito: CheckCircle2,
  parcial: CircleDot,
  pendente: Circle,
  descanso: Moon,
};

/** Linha de lista M3 de 68dp: data/dia, assuntos, minutos e estado. */
export function PlanDayRow({
  day,
  sessions,
  today,
  onOpen,
}: {
  day: PlanDay;
  sessions: readonly StudySession[];
  today: string;
  onOpen: () => void;
}) {
  const state = planDayState(day, sessions);
  const { title, detail } = planDayTopics(day);
  const load = day.blocks.reduce((sum, block) => sum + block.plannedMin, 0);
  const Icon = STATE_ICON[state];
  const isToday = day.date === today;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={isToday ? "date" : undefined}
      aria-label={`${formatWeekday(day.date)}, ${dayMonth(day.date)}. ${title}. ${
        load > 0 ? formatMin(load) : "Sem carga"
      }. ${PLAN_DAY_STATE_LABEL[state]}.`}
      className={cn(
        "flex min-h-[68px] w-full items-center gap-3 rounded-xl border bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-2",
        isToday ? "border-primary" : "border-border",
      )}
    >
      <span className="flex w-14 shrink-0 flex-col">
        <span className="text-base font-semibold tabular-nums text-fg">{dayMonth(day.date)}</span>
        <span className="text-xs text-muted">{formatWeekday(day.date)}</span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{title}</span>
        {detail ? <span className="mt-0.5 block truncate text-xs text-muted">{detail}</span> : null}
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs tabular-nums text-muted">
          {load > 0 ? formatMin(load) : "Sem carga"}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium",
            state === "feito" ? "text-primary" : state === "parcial" ? "text-fg" : "text-muted",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {PLAN_DAY_STATE_LABEL[state]}
        </span>
      </span>
    </button>
  );
}
