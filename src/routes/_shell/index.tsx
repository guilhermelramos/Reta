import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/feedback/error-copy";
import { useStudy } from "@/lib/study/store";
import { dayLoad, daysBetween, examDate, formatLongDate, formatMin, saoPauloParts, saoPauloToday, topicLine } from "@/lib/study/time";
import type { BlockKind, PlanBlock, StudySession } from "@/lib/study/types";
import { KIND_LABEL } from "@/lib/study/types";

export const Route = createFileRoute("/_shell/")({
  head: () => ({ meta: [{ title: "Hoje · Reta" }] }),
  component: TodayPage,
});

function statusOf(sessions: StudySession[], date: string, kind: BlockKind): "idle" | "active" | "done" {
  const rows = sessions.filter((s) => s.date === date && s.kind === kind);
  if (rows.some((s) => s.status === "active")) return "active";
  if (rows.some((s) => s.status === "done")) return "done";
  return "idle";
}

function realMin(sessions: StudySession[], date: string, kind: BlockKind): number {
  const sec = sessions.filter((s) => s.date === date && s.kind === kind).reduce((sum, s) => sum + s.elapsedSec, 0);
  return Math.round(sec / 60);
}

function TodayPage() {
  const study = useStudy();
  const today = saoPauloToday();
  const day = study.days.find((item) => item.date === today);
  const exam = examDate(study.days);
  const left = exam ? daysBetween(today, exam) : null;
  const clock = saoPauloParts();
  const studyMin = study.settings.studyHour * 60 + study.settings.studyMinute;
  const nowMin = clock.hour * 60 + clock.minute;
  const pending = day?.blocks.find((b) => b.plannedMin > 0 && statusOf(study.sessions, today, b.kind) === "idle");
  const nag = !study.settings.quiet && study.settings.alerts.pending && pending && nowMin >= studyMin + 45;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <p className="text-sm text-muted">{formatLongDate(today)}</p>
        <h1 className="mt-1 text-4xl text-fg">O que estudar agora</h1>
        {left != null ? (
          <p className="mt-2 text-sm text-muted">
            {left > 0 ? `Faltam ${left} dias para a prova.` : left === 0 ? "A prova é hoje." : "A data da prova já passou."}
          </p>
        ) : null}
        <div className="no-print mt-4 flex flex-wrap gap-2">
          <Button variant="surface" asChild>
            <Link to="/importar">Trocar planilha</Link>
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>Exportar resumo</Button>
        </div>
      </header>

      {nag && pending ? (
        <p className="rounded-xl border border-primary/40 bg-surface px-4 py-3 text-sm">
          Bloco de hoje ainda não iniciado: {KIND_LABEL[pending.kind]} · {formatMin(pending.plannedMin)}
        </p>
      ) : null}

      <PrepRow from={today} />

      {!day ? (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-2xl">Este dia não está no plano</h2>
          <p className="mt-2 text-sm text-muted">Importe a planilha ou escolha outra data no plano.</p>
          <Button className="mt-4" asChild>
            <Link to="/plano">Ver o plano</Link>
          </Button>
        </section>
      ) : (
        <>
          <p className="text-sm text-muted">{day.phase || "Dia de estudo"} · {formatMin(dayLoad(day))} no papel</p>
          <div className="flex flex-col gap-3">
            {day.blocks.map((block, index) => (
              <BlockRow
                key={block.kind}
                date={day.date}
                block={block}
                featured={featuredIndex(day.blocks, study.sessions, day.date) === index}
                state={statusOf(study.sessions, day.date, block.kind)}
                spent={realMin(study.sessions, day.date, block.kind)}
                hasPackage={study.packages.some((p) => p.id === `${day.date}:${block.kind}`)}
              />
            ))}
          </div>
          <section className="print-only hidden">
            <h2 className="text-2xl">Resumo · {formatLongDate(day.date)}</h2>
            <p>{day.phase}</p>
            <ul>
              {day.blocks.map((block) => (
                <li key={block.kind}>
                  {KIND_LABEL[block.kind]} ({formatMin(block.plannedMin)}): {block.content}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function featuredIndex(blocks: PlanBlock[], sessions: StudySession[], date: string): number {
  const idx = blocks.findIndex((b) => b.plannedMin > 0 && statusOf(sessions, date, b.kind) !== "done");
  return idx >= 0 ? idx : 0;
}

function BlockRow({
  date, block, featured, state, spent, hasPackage,
}: {
  date: string;
  block: PlanBlock;
  featured: boolean;
  state: "idle" | "active" | "done";
  spent: number;
  hasPackage: boolean;
}) {
  const canStart = block.plannedMin > 0;
  const label = state === "done" ? "Feito" : state === "active" ? "Em andamento" : hasPackage ? "Pacote pronto" : "Pacote na hora";
  return (
    <article className={featured ? "rounded-xl border border-primary/50 bg-surface p-5" : "rounded-xl border border-border bg-surface p-4"}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={featured ? "text-sm text-primary" : "text-sm text-muted"}>{KIND_LABEL[block.kind]}</p>
        <p className="tabular-nums text-sm text-muted">{formatMin(block.plannedMin)}</p>
      </div>
      <h2 className={featured ? "mt-2 text-2xl" : "mt-2 text-lg"}>{topicLine(block.content, featured ? 140 : 110)}</h2>
      <p className="mt-2 text-xs text-muted">
        {label}
        {spent > 0 ? ` · Estudado: ${spent} min` : ""}
      </p>
      {canStart ? (
        <div className="no-print mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/sessao" search={{ dia: date, bloco: block.kind, modo: "cheio", auto: 1 }}>
              {state === "active" ? "Continuar" : "Iniciar"}
            </Link>
          </Button>
          {block.plannedMin > 15 ? (
            <Button variant="surface" asChild>
              <Link to="/sessao" search={{ dia: date, bloco: block.kind, modo: "15", auto: 1 }}>Só 15 min</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Sem carga hoje.</p>
      )}
    </article>
  );
}

function PrepRow({ from }: { from: string }) {
  const { prep, startPrep, cancelPrep } = useStudy();
  const pct = prep.total ? Math.round((prep.done / prep.total) * 100) : 0;
  return (
    <section className="no-print rounded-xl border border-border bg-surface-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Pacotes dos próximos 7 dias, um bloco por vez.</p>
        {prep.running ? (
          <Button variant="ghost" onClick={cancelPrep}>Parar</Button>
        ) : (
          <Button variant="surface" onClick={() => startPrep(from)}>
            {prep.failures.length ? "Tentar de novo" : "Preparar semana"}
          </Button>
        )}
      </div>
      {prep.running || prep.current ? (
        <>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-bg" aria-hidden>
            <div className="h-full bg-primary" style={{ width: prep.running ? `${Math.max(pct, 8)}%` : "100%" }} />
          </div>
          <p className="mt-2 text-xs text-muted">{prep.current}{prep.total ? ` · ${Math.min(prep.done + (prep.running ? 1 : 0), prep.total)}/${prep.total}` : ""}</p>
        </>
      ) : null}
      {prep.failures.length ? (
        <ul className="mt-2 text-xs text-clay-text">
          {prep.failures.map((f) => (
            <li key={f.label}>{f.label}: {describeError(f.error).message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
