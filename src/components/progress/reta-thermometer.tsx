import { cn } from "@/lib/cn";
import type { RetaCoverage } from "@/lib/study/progress-metrics";
import { formatShortDate } from "@/lib/study/time";

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

export function RetaThermometer({ coverage }: { coverage: RetaCoverage }) {
  if (coverage.status === "vazio" || !coverage.endDate) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-xl">Termômetro da Reta</h2>
        <p className="mt-2 text-sm text-muted">
          Importe o cronograma para medir a cobertura dos blocos planejados até a prova.
        </p>
      </section>
    );
  }

  const markerLeft = Math.min(100, Math.max(0, coverage.expectedPct));

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">Termômetro da Reta</h2>
          <p className="mt-1 text-xs text-muted">
            Blocos planejados concluídos até {formatShortDate(coverage.endDate)}.
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
            STATUS_CLASS[coverage.status],
          )}
        >
          {STATUS_LABEL[coverage.status]}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="font-display text-4xl leading-none tabular-nums text-primary">
          {coverage.pct}
          <span className="text-xl text-muted">%</span>
        </p>
        <p className="text-right text-xs text-muted">
          {coverage.done} de {coverage.planned} blocos
          <br />
          {coverage.daysLeft > 0
            ? `${coverage.daysLeft} dias para a prova`
            : coverage.daysLeft === 0
              ? "A prova é hoje"
              : "A data da prova passou"}
        </p>
      </div>

      <div className="relative mt-3 h-3 rounded-full bg-surface-2" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${coverage.pct}%` }}
        />
        <span
          className="absolute -top-1 h-5 w-0.5 rounded-full bg-fg/60"
          style={{ left: `calc(${markerLeft}% - 1px)` }}
          title={`Esperado até hoje: ${coverage.expectedPct}%`}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        Esperado até hoje: {coverage.expectedPct}%
        {coverage.pct >= coverage.expectedPct
          ? ` · ${coverage.pct - coverage.expectedPct} pontos à frente.`
          : ` · ${coverage.expectedPct - coverage.pct} pontos de atraso.`}
      </p>
    </section>
  );
}
