import type { FoldMetric } from "@/lib/study/progress-dashboard";

/**
 * As três métricas da primeira dobra. Números grandes (26px, tabulares) e
 * rótulo de 12px; o cartão inteiro tem um nome acessível com o contexto, para
 * o leitor de tela não ler "12" e "de 18h na semana" como coisas soltas.
 */
export function MetricRow({ metrics }: { metrics: FoldMetric[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2" aria-label="Resumo do progresso">
      {metrics.map((metric) => (
        <li
          key={metric.key}
          aria-label={metric.ariaLabel}
          className="flex min-h-20 flex-col justify-between rounded-xl border border-border bg-surface p-3"
        >
          <p aria-hidden className="text-[26px] font-semibold leading-none tabular-nums text-fg">
            {metric.value}
          </p>
          <p aria-hidden className="mt-2 text-xs leading-tight text-muted">
            {metric.label}
          </p>
        </li>
      ))}
    </ul>
  );
}
