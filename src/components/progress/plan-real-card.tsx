import { formatHoursCompact, type PlanRealRow } from "@/lib/study/progress-dashboard";

/**
 * Planejado × real por assunto: uma barra simples por linha, com os dois
 * valores escritos ao lado (a barra é só o resumo visual).
 */
export function PlanRealCard({ rows }: { rows: PlanRealRow[] }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-xl">Planejado e real</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Tempo de estudo por assunto do plano.
      </p>

      {rows.length ? (
        <ul className="mt-3 flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {row.plannedMin > 0
                    ? `${formatHoursCompact(row.studiedMin)} de ${formatHoursCompact(row.plannedMin)}`
                    : formatHoursCompact(row.studiedMin)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Importe o plano para comparar o tempo planejado com o estudado.
        </p>
      )}
    </section>
  );
}
