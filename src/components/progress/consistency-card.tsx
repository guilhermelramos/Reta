import { Flame } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMin } from "@/lib/study/time";
import type { ConsistencyCell, ConsistencySummary, ConsistencyState } from "@/lib/study/progress-metrics";

const STATE_LABEL: Record<ConsistencyState, string> = {
  meta: "Meta batida",
  parcial: "Parcial",
  branco: "Em branco",
  livre: "Dia livre",
};

const CELL_CLASS: Record<ConsistencyState, string> = {
  meta: "border-primary bg-primary",
  parcial: "border-primary/50 bg-primary/35",
  branco: "border-border bg-surface-2",
  livre: "border-dashed border-border/70 bg-transparent",
};

const LEGEND: { state: ConsistencyState; className: string }[] = [
  { state: "meta", className: "bg-primary" },
  { state: "parcial", className: "bg-primary/35" },
  { state: "branco", className: "bg-surface-2 border border-border" },
  { state: "livre", className: "border border-dashed border-border/70" },
];

function dayTitle(cell: ConsistencyCell): string {
  const date = cell.date.split("-").reverse().slice(0, 2).join("/");
  const planned = cell.plannedMin > 0 ? ` · ${formatMin(cell.plannedMin)} no plano` : "";
  // `formatMin` já devolve "0 min" para dias sem estudo.
  return `${date} · ${STATE_LABEL[cell.state]} · ${formatMin(cell.studiedMin)} estudados${planned}`;
}

export function ConsistencyCard({ summary }: { summary: ConsistencySummary }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">Consistência</h2>
          <p className="mt-1 text-xs text-muted">Últimos {summary.windowDays} dias. Dias livres não quebram a sequência.</p>
        </div>
        <p className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-sm tabular-nums text-primary">
          <Flame className="size-3.5" aria-hidden />
          {summary.streak}
          <span className="text-[11px] font-normal">
            {summary.streak === 1 ? "dia" : "dias"}
          </span>
        </p>
      </div>

      <ul className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Heatmap dos últimos 28 dias">
        {summary.cells.map((cell) => (
          <li key={cell.date}>
            <div
              title={dayTitle(cell)}
              className={cn(
                "aspect-square min-h-6 rounded-md border transition-colors",
                CELL_CLASS[cell.state],
                cell.isToday && "ring-2 ring-fg/70 ring-offset-1 ring-offset-surface",
              )}
            >
              <span className="sr-only">{dayTitle(cell)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted">
        {LEGEND.map((item) => (
          <span key={item.state} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", item.className)} aria-hidden />
            {STATE_LABEL[item.state]}
          </span>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Mini k="Meta" v={String(summary.metDays)} tone="primary" />
        <Mini k="Parcial" v={String(summary.partialDays)} />
        <Mini k="Em branco" v={String(summary.blankDays)} />
      </dl>
      <p className="mt-3 text-xs text-muted">
        {formatMin(summary.studiedMin)} estudados
        {summary.plannedMin > 0 ? ` de ${formatMin(summary.plannedMin)} planejados (${summary.goalPct}%).` : "."}
      </p>
    </section>
  );
}

function Mini({ k, v, tone }: { k: string; v: string; tone?: "primary" }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-2 py-2">
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className={cn("font-display text-2xl tabular-nums", tone === "primary" && "text-primary")}>{v}</dd>
    </div>
  );
}
