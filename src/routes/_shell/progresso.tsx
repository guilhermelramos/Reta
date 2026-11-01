import { createFileRoute } from "@tanstack/react-router";
import { useStudy } from "@/lib/study/store";
import { addDays, dayLoad, formatMin, formatShortDate, saoPauloToday } from "@/lib/study/time";
import type { BlockKind, PlanDay, StudySession } from "@/lib/study/types";
import { KIND_LABEL } from "@/lib/study/types";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_shell/progresso")({
  head: () => ({ meta: [{ title: "Progresso · Reta" }] }),
  component: ProgressPage,
});

const KINDS: BlockKind[] = ["A", "B", "R", "L"];

function studiedDates(sessions: StudySession[]): Set<string> {
  return new Set(sessions.filter((s) => s.status === "done" || s.status === "active" || s.elapsedSec >= 60).map((s) => s.date));
}

function streakCount(days: PlanDay[], sessions: StudySession[], today: string): number {
  const hit = studiedDates(sessions);
  let cursor = hit.has(today) ? today : addDays(today, -1);
  let count = 0;
  for (let i = 0; i < 80; i += 1) {
    const day = days.find((d) => d.date === cursor);
    if (!day) break;
    if (dayLoad(day) <= 0) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!hit.has(cursor)) break;
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function ProgressPage() {
  const { days, sessions } = useStudy();
  const today = saoPauloToday();
  const streak = streakCount(days, sessions, today);
  const hit = studiedDates(sessions);
  const questions = sessions.reduce((sum, s) => sum + s.correct + s.wrong, 0);
  const right = sessions.reduce((sum, s) => sum + s.correct, 0);
  const rate = questions ? Math.round((right / questions) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-4xl">Progresso</h1>
        <p className="mt-2 text-sm text-muted">Sequência de {streak} {streak === 1 ? "dia" : "dias"}. Dias livres não quebram a conta.</p>
      </header>
      <dl className="grid grid-cols-3 gap-3">
        <Stat k="Sequência" v={String(streak)} />
        <Stat k="Questões" v={String(questions)} />
        <Stat k="Acertos" v={questions ? `${rate}%` : "—"} />
      </dl>
      <section>
        <h2 className="text-xl">Dias do plano</h2>
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {days.map((day) => {
            const future = day.date > today;
            const rest = dayLoad(day) <= 0;
            const ok = hit.has(day.date);
            const missed = !future && !rest && !ok && day.date < today;
            return (
              <li key={day.date}>
                <div
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center rounded-xl border text-xs",
                    ok && "border-primary bg-primary/20 text-fg",
                    missed && "border-clay/40 text-clay-text",
                    rest && "border-border text-muted",
                    future && "border-border text-muted",
                    day.date === today && "ring-1 ring-primary",
                  )}
                  title={day.phase}
                >
                  <span>{formatShortDate(day.date)}</span>
                  <span className="text-muted">{ok ? "feito" : rest ? "livre" : future ? "vem" : "falta"}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h2 className="text-xl">Planejado e real</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {KINDS.map((kind) => {
            const planned = days.reduce((sum, d) => sum + (d.blocks.find((b) => b.kind === kind)?.plannedMin ?? 0), 0);
            const real = Math.round(sessions.filter((s) => s.kind === kind).reduce((sum, s) => sum + s.elapsedSec, 0) / 60);
            const max = Math.max(planned, real, 1);
            if (!planned) return null;
            return (
              <li key={kind}>
                <div className="flex justify-between text-sm">
                  <span>{KIND_LABEL[kind]}</span>
                  <span className="tabular-nums text-muted">{formatMin(real)} / {formatMin(planned)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((real / max) * 100))}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="font-display text-3xl tabular-nums">{v}</dd>
    </div>
  );
}
