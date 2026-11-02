import { cn } from "@/lib/cn";
import type { PlanDayRow, PlanDayState } from "@/lib/study/progress-dashboard";
import type { RetaCoverage } from "@/lib/study/progress-metrics";

const STATUS_LABEL: Record<RetaCoverage["status"], string> = {
  vazio: "Sem cronograma",
  adiantado: "Adiantado",
  "no ritmo": "No ritmo",
  atrasado: "Atrasado",
};

const STATUS_CLASS: Record<RetaCoverage["status"], string> = {
  vazio: "border-border text-muted",
  adiantado: "border-primary/50 bg-primary/10 text-primary",
  "no ritmo": "border-primary/40 text-primary",
  atrasado: "border-clay/50 bg-clay/10 text-clay-text",
};

const DAY_CLASS: Record<PlanDayState, string> = {
  feito: "border-primary bg-primary/20 text-fg",
  parcial: "border-primary/50 bg-primary/10 text-fg",
  falta: "border-clay/40 text-clay-text",
  livre: "border-border text-muted",
  vem: "border-border text-muted",
};

/**
 * Termômetro da reta + dias do plano, compactos e no fim da tela.
 *
 * A barra mostra a cobertura do plano, mas o percentual já está na primeira
 * dobra: aqui só aparecem os blocos concluídos e o esperado até hoje, para não
 * repetir o mesmo número. Os dias são uma grade de datas com estado escrito
 * (nunca só a cor).
 */
export function PlanDaysCard({
  coverage,
  rows,
}: {
  coverage: RetaCoverage;
  rows: PlanDayRow[];
}) {
  const marker = Math.max(0, Math.min(100, coverage.expectedPct));

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl">Dias do plano</h2>
        {coverage.status !== "vazio" ? (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
              STATUS_CLASS[coverage.status],
            )}
          >
            {STATUS_LABEL[coverage.status]}
          </span>
        ) : null}
      </div>

      {coverage.status === "vazio" ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Importe o cronograma para medir a cobertura dos blocos planejados até a prova.
        </p>
      ) : (
        <>
          <div className="relative mt-3 h-2 rounded-full bg-surface-2" aria-hidden>
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(0, Math.min(100, coverage.pct))}%` }}
            />
            <span
              className="absolute -top-1 h-4 w-0.5 rounded-full bg-fg/70"
              style={{ left: `calc(${marker}% - 1px)` }}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {coverage.done} de {coverage.planned} blocos concluídos · esperado {coverage.expectedPct}%
            até hoje
          </p>
        </>
      )}

      {rows.length ? (
        <ul
          className="mt-3 grid grid-cols-4 gap-1.5 min-[360px]:grid-cols-6"
          aria-label="Dias do plano"
        >
          {rows.map((row) => (
            <li key={row.date}>
              <div
                title={`${row.label} · ${row.stateLabel}`}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center rounded-lg border px-1 text-xs leading-tight",
                  DAY_CLASS[row.state],
                  row.isToday && "ring-1 ring-primary ring-offset-1 ring-offset-surface",
                )}
              >
                <span className="tabular-nums">{row.label}</span>
                <span className="text-xs">{row.stateLabel}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
