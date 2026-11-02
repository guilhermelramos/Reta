import { createFileRoute, Link } from "@tanstack/react-router";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useBackOverlay } from "@/lib/android/use-back-overlay";
import { cn } from "@/lib/cn";
import { describeError } from "@/lib/feedback/error-copy";
import { isDueToday } from "@/lib/study/srs";
import { useStudy } from "@/lib/study/store";
import {
  blockState,
  emptyBlocksLine,
  loadBlocks,
  nextAction,
  prepSuggestionVisible,
  studiedMinutesFor,
  weekKey,
  type BlockState,
} from "@/lib/study/today";
import {
  dayLoad,
  daysBetween,
  examDate,
  formatLongDate,
  formatMin,
  saoPauloParts,
  saoPauloToday,
  topicLine,
} from "@/lib/study/time";
import type { PlanBlock } from "@/lib/study/types";
import { KIND_LABEL } from "@/lib/study/types";

export const Route = createFileRoute("/_shell/")({
  head: () => ({ meta: [{ title: "Hoje · Reta" }] }),
  component: TodayPage,
});

function TodayPage() {
  const study = useStudy();
  const today = saoPauloToday();
  const day = study.days.find((item) => item.date === today);
  const exam = examDate(study.days);
  const left = exam ? daysBetween(today, exam) : null;
  const clock = saoPauloParts();
  const studyMin = study.settings.studyHour * 60 + study.settings.studyMinute;
  const nowMin = clock.hour * 60 + clock.minute;
  const action = day ? nextAction(day.blocks, study.sessions, day.date) : null;
  const others =
    day && action ? loadBlocks(day.blocks).filter((b) => b.kind !== action.block.kind) : [];
  const emptyLine = day ? emptyBlocksLine(day.blocks) : null;
  const load = day ? dayLoad(day) : 0;
  const dueMistakes = study.mistakes.filter((mistake) => isDueToday(mistake, today));
  const pending =
    day?.blocks.find(
      (b) => b.plannedMin > 0 && blockState(study.sessions, today, b.kind) === "idle",
    ) ?? null;
  const nag =
    !study.settings.quiet && study.settings.alerts.pending && pending && nowMin >= studyMin + 45;

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-3">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted">{formatLongDate(today)}</p>
          <h1 className="mt-1 text-3xl leading-tight text-fg">O que estudar agora</h1>
          {left != null ? (
            <p className="mt-2 text-sm text-muted">
              {left > 0
                ? `Faltam ${left} dias para a prova.`
                : left === 0
                  ? "A prova é hoje."
                  : "A data da prova já passou."}
            </p>
          ) : null}
        </div>
        <TodayMenu />
      </header>

      {day ? (
        <>
          <p className="text-sm text-muted">
            {day.phase || "Dia de estudo"}
            {load > 0 ? ` · ${formatMin(load)} no papel` : ""}
          </p>

          {action ? (
            <HeroCard
              date={day.date}
              action={action}
              spent={studiedMinutesFor(study.sessions, day.date, action.block.kind)}
              hasPackage={Boolean(study.packageFor(day.date, action.block.kind))}
            />
          ) : (
            <RestCard due={dueMistakes.length} allDone={load > 0} />
          )}

          {nag && pending ? (
            <p className="no-print rounded-xl border border-primary/40 bg-surface px-4 py-3 text-sm">
              Bloco de hoje ainda não iniciado: {KIND_LABEL[pending.kind]} ·{" "}
              {formatMin(pending.plannedMin)}
            </p>
          ) : null}

          {others.length ? (
            <section aria-labelledby="outros-blocos" className="flex flex-col gap-3">
              <h2 id="outros-blocos" className="text-lg">
                Outros blocos de hoje
              </h2>
              <ul className="flex flex-col gap-3">
                {others.map((block) => (
                  <BlockCard
                    key={block.kind}
                    date={day.date}
                    block={block}
                    state={blockState(study.sessions, day.date, block.kind)}
                    spent={studiedMinutesFor(study.sessions, day.date, block.kind)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {emptyLine ? <p className="text-sm text-muted">{emptyLine}</p> : null}

          <PrepSuggestion today={today} />

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
      ) : (
        <>
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-2xl">Este dia não está no plano</h2>
            <p className="mt-2 text-sm text-muted">
              Troque a planilha no menu de opções ou escolha outra data no plano.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/plano">Ver o plano</Link>
            </Button>
          </section>
          <PrepSuggestion today={today} />
        </>
      )}
    </div>
  );
}

/** Menu de overflow do topo: as ações que saíram do cabeçalho, sem sumir. */
function TodayMenu() {
  const [open, setOpen] = useState(false);
  // O voltar do Android fecha o menu antes de considerar o histórico.
  useBackOverlay(open, () => setOpen(false));

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Mais opções"
          className="no-print grid size-12 shrink-0 place-items-center rounded-full text-fg transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2"
        >
          <MoreVertical className="size-6" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          aria-label="Ações da tela Hoje"
          className="no-print z-50 min-w-56 rounded-xl border border-border bg-surface-2 p-1 shadow-xl"
        >
          <DropdownMenu.Item asChild>
            <Link
              to="/importar"
              className="flex min-h-12 items-center rounded-lg px-3 text-sm text-fg outline-none data-[highlighted]:bg-surface"
            >
              Trocar planilha
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => window.setTimeout(() => window.print(), 0)}
            className="flex min-h-12 items-center rounded-lg px-3 text-sm text-fg outline-none data-[highlighted]:bg-surface"
          >
            Exportar resumo
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function HeroCard({
  date,
  action,
  spent,
  hasPackage,
}: {
  date: string;
  action: { block: PlanBlock; state: "idle" | "active" };
  spent: number;
  hasPackage: boolean;
}) {
  const { block, state } = action;
  return (
    <section
      aria-label="Próxima ação"
      className="rounded-xl border border-primary bg-surface-2 p-5"
    >
      <p className="text-sm font-semibold text-primary">{KIND_LABEL[block.kind]}</p>
      <h2 className="mt-1 text-2xl leading-snug">{topicLine(block.content, 140)}</h2>
      <p className="mt-2 text-sm text-muted">
        {state === "active" ? "Em andamento · " : ""}
        {formatMin(block.plannedMin)}
        {spent > 0 ? ` · ${spent} min estudados` : ""}
        {hasPackage ? " · Pacote pronto" : ""}
      </p>
      <div className="no-print mt-4 flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link to="/sessao" search={{ dia: date, bloco: block.kind, modo: "cheio", auto: 1 }}>
            {state === "active" ? "Continuar" : "Começar bloco"}
          </Link>
        </Button>
        {block.plannedMin > 15 ? (
          <Button variant="ghost" asChild>
            <Link to="/sessao" search={{ dia: date, bloco: block.kind, modo: "15", auto: 1 }}>
              Só 15 min
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function BlockCard({
  date,
  block,
  state,
  spent,
}: {
  date: string;
  block: PlanBlock;
  state: BlockState;
  spent: number;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{KIND_LABEL[block.kind]}</p>
          <h3 className="mt-1 text-lg leading-snug">{topicLine(block.content, 110)}</h3>
        </div>
        <StateChip state={state} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {formatMin(block.plannedMin)}
        {spent > 0 ? ` · ${spent} min estudados` : ""}
      </p>
      <div className="no-print mt-3 flex flex-wrap gap-2">
        <Button variant="surface" asChild>
          <Link to="/sessao" search={{ dia: date, bloco: block.kind, modo: "cheio", auto: 1 }}>
            {state === "active" ? "Continuar" : state === "done" ? "Reabrir" : "Iniciar"}
          </Link>
        </Button>
        {block.plannedMin > 15 ? (
          <Button variant="ghost" asChild>
            <Link to="/sessao" search={{ dia: date, bloco: block.kind, modo: "15", auto: 1 }}>
              Só 15 min
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function StateChip({ state }: { state: BlockState }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-1 text-xs",
        state === "active"
          ? "border-primary/50 text-primary"
          : state === "done"
            ? "border-border bg-surface-2 text-muted"
            : "border-border text-muted",
      )}
    >
      {state === "active" ? "Em andamento" : state === "done" ? "Concluído" : "Pendente"}
    </span>
  );
}

function RestCard({ due, allDone }: { due: number; allDone: boolean }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-2xl">{allDone ? "Blocos de hoje concluídos" : "Hoje é descanso"}</h2>
      <p className="mt-2 text-sm text-muted">
        {allDone
          ? "Você já cumpriu a carga do dia. Revisar os erros mantém o que você aprendeu."
          : "Sem carga no plano de hoje. Aproveite para descansar ou revisar o que errou."}
      </p>
      {due > 0 ? (
        <Button variant="surface" className="mt-4" asChild>
          <Link to="/erros">Revisar erros ({due})</Link>
        </Button>
      ) : null}
    </section>
  );
}

function PrepSuggestion({ today }: { today: string }) {
  const { prep, startPrep, cancelPrep, prepDismissedWeek, dismissPrepWeek } = useStudy();
  const visible = prepSuggestionVisible({
    dismissedWeek: prepDismissedWeek,
    today,
    running: prep.running,
  });
  if (!visible) return null;

  const pct = prep.total ? Math.round((prep.done / prep.total) * 100) : 0;
  const finished = !prep.running && prep.total > 0 && prep.done >= prep.total;

  return (
    <section className="no-print rounded-xl border border-border bg-surface-2 p-4">
      <h2 className="text-lg">Preparar semana</h2>
      <p className="mt-1 text-sm text-muted">Pacotes dos próximos 7 dias, um bloco por vez.</p>

      {prep.running ? (
        <>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-bg" aria-hidden>
            <div className="h-full bg-primary" style={{ width: `${Math.max(pct, 8)}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {prep.current}
            {prep.total ? ` · ${Math.min(prep.done + 1, prep.total)}/${prep.total}` : ""}
          </p>
          <Button variant="ghost" className="mt-2" onClick={cancelPrep}>
            Parar
          </Button>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant={finished ? "surface" : "primary"} onClick={() => startPrep(today)}>
            {prep.failures.length ? "Tentar de novo" : "Preparar"}
          </Button>
          <Button variant="ghost" onClick={() => void dismissPrepWeek(weekKey(today))}>
            Dispensar
          </Button>
        </div>
      )}

      {finished ? <p className="mt-2 text-xs text-muted">{prep.current}</p> : null}
      {!prep.running && !finished && prep.current && !prep.done ? (
        <p className="mt-2 text-xs text-muted">{prep.current}</p>
      ) : null}

      {prep.failures.length ? (
        <ul className="mt-2 text-xs text-clay-text">
          {prep.failures.map((failure) => (
            <li key={failure.label}>
              {failure.label}: {describeError(failure.error).message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
