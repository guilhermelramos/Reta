import { Fragment } from "react";
import { cn } from "@/lib/cn";
import type { Heatmap, HeatmapCell, HeatmapLevel } from "@/lib/study/progress-dashboard";

const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: "border border-border bg-surface-2",
  1: "bg-primary/20",
  2: "bg-primary/40",
  3: "bg-primary/65",
  4: "bg-primary",
};

function cellTitle(cell: HeatmapCell): string {
  return [cell.ariaLabel, cell.isToday ? "hoje" : "", cell.rest ? "dia livre" : ""]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Mapa de calor dos últimos 28 dias, alinhado por semana (segunda → domingo).
 *
 * Cada célula tem pelo menos 12px com 4px de respiro e um `aria-label`
 * "DD/MM: N min"; o dia de hoje ganha contorno (não depende só da cor) e o dia
 * livre do plano ganha borda tracejada. A legenda "menos → mais" explica a
 * escala sem depender de números.
 */
export function HeatmapCard({ heatmap }: { heatmap: Heatmap }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-xl">Últimos 28 dias</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Dias livres não quebram a sequência.
      </p>

      <div className="mt-3 grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] items-center gap-1">
        <span aria-hidden />
        {heatmap.weekdayInitials.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            aria-hidden
            className="text-center text-xs font-medium text-muted"
          >
            {letter}
          </span>
        ))}

        {heatmap.weeks.map((week) => (
          <Fragment key={week.start}>
            <span className="self-center text-xs tabular-nums text-muted">{week.label}</span>
            {week.cells.map((cell, index) =>
              cell ? (
                <span
                  key={cell.date}
                  role="img"
                  aria-label={cell.ariaLabel}
                  title={cellTitle(cell)}
                  className={cn(
                    "block aspect-square min-h-3 w-full rounded-[4px]",
                    LEVEL_CLASS[cell.level],
                    cell.rest && "border border-dashed border-border",
                    cell.isToday && "ring-2 ring-fg/80 ring-offset-1 ring-offset-surface",
                  )}
                />
              ) : (
                <span key={`vazio-${week.start}-${index}`} aria-hidden />
              ),
            )}
          </Fragment>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <span>menos</span>
        {([0, 1, 2, 3, 4] as HeatmapLevel[]).map((level) => (
          <span
            key={level}
            aria-hidden
            className={cn("size-3 rounded-[3px]", LEVEL_CLASS[level])}
          />
        ))}
        <span>mais</span>
      </div>
    </section>
  );
}
