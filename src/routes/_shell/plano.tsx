import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/lib/study/store";
import { dayLoad, formatLongDate, formatMin, formatShortDate, formatWeekday, saoPauloToday, topicLine } from "@/lib/study/time";
import { KIND_LABEL } from "@/lib/study/types";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_shell/plano")({
  head: () => ({ meta: [{ title: "Plano · Reta" }] }),
  component: PlanPage,
});

function PlanPage() {
  const { days, sessions } = useStudy();
  const today = saoPauloToday();
  const [open, setOpen] = useState(today);
  const selected = days.find((d) => d.date === open) ?? days.find((d) => d.date >= today) ?? days[0];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header>
        <h1 className="text-4xl">Plano</h1>
        <p className="mt-2 text-sm text-muted">{days.length} dias. A revisão é a da planilha — o app não inventa outra agenda.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <ul className="flex max-h-96 flex-col gap-1 overflow-auto pr-1 md:max-h-screen">
          {days.map((day) => {
            const done = day.blocks.filter((b) => b.plannedMin > 0 && sessions.some((s) => s.date === day.date && s.kind === b.kind && s.status === "done")).length;
            const load = day.blocks.filter((b) => b.plannedMin > 0).length;
            const active = selected?.date === day.date;
            return (
              <li key={day.date}>
                <button
                  type="button"
                  onClick={() => setOpen(day.date)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left",
                    active ? "bg-surface-2" : "hover:bg-surface",
                    day.date === today && "ring-1 ring-primary/50",
                  )}
                >
                  <span>
                    <span className="text-xs uppercase text-muted">{formatWeekday(day.date)}</span>
                    <span className="ml-2">{formatShortDate(day.date)}</span>
                  </span>
                  <span className="text-xs text-muted">{dayLoad(day) ? `${done}/${load}` : "livre"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {selected ? (
          <section className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">{formatLongDate(selected.date)}</p>
            <h2 className="mt-1 text-2xl">{selected.phase || "Dia"}</h2>
            <p className="mt-1 text-sm text-muted">{formatMin(dayLoad(selected))}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {selected.blocks.map((block) => (
                <li key={block.kind} className="border-t border-border pt-3">
                  <p className="text-xs text-primary">{KIND_LABEL[block.kind]} · {formatMin(block.plannedMin)}</p>
                  <p className="mt-1 text-sm leading-relaxed">{topicLine(block.content, 220)}</p>
                  {block.plannedMin > 0 ? (
                    <Button className="mt-2" variant="surface" asChild>
                      <Link to="/sessao" search={{ dia: selected.date, bloco: block.kind, modo: "cheio", auto: 1 }}>Iniciar</Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-muted">Nenhum dia importado.</p>
        )}
      </div>
    </div>
  );
}
