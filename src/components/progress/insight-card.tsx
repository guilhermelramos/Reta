import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type InsightItem = {
  key: string;
  label: string;
  /** Valor curto em texto (ex.: "60%", "4 erros"). */
  value: string;
  /** 0 a 100; a barra é só a proporção visual. */
  pct: number;
  tone?: "primary" | "clay";
};

/**
 * Cartão de lista curta (até 5 itens) com barra de proporção.
 *
 * Cada item é um link para o caderno de erros — o caderno ainda não aceita
 * filtro por query, então todos levam a `/erros`. O rodapé repete o destino no
 * botão de texto "Ver todos".
 */
export function InsightCard({
  title,
  subtitle,
  items,
  emptyText,
}: {
  title: string;
  subtitle: string;
  items: InsightItem[];
  emptyText: string;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface p-4">
      <h2 className="text-xl">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>

      {items.length ? (
        <>
          <ul className="mt-2 flex flex-col">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  to="/erros"
                  className="-mx-2 flex min-h-12 flex-col justify-center rounded-lg px-2 py-1.5 hover:bg-surface-2"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm text-fg">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted">
                      {item.value}
                      <ChevronRight className="size-4 text-muted" aria-hidden />
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span
                      aria-hidden
                      className={cn(
                        "block h-full rounded-full",
                        item.tone === "clay" ? "bg-clay" : "bg-primary",
                      )}
                      style={{ width: `${Math.max(3, Math.min(100, item.pct))}%` }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/erros"
            className="mt-auto inline-flex min-h-12 items-center self-start px-1 text-sm font-semibold text-primary"
          >
            Ver todos
          </Link>
        </>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted">{emptyText}</p>
      )}
    </section>
  );
}
