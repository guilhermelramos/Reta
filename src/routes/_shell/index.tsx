import { createFileRoute, Link } from "@tanstack/react-router";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Download, FileUp, MoreVertical } from "lucide-react";
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
  isLatePending,
  loadBlocks,
  nextAction,
  prepSuggestionVisible,
  showsShortSession,
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

/** Filled tonal M3: âmbar sobre o fundo tonal, sem competir com o CTA do herói. */
const TONAL_BUTTON =
  "border-[1.5px] border-primary bg-primary-tonal text-primary hover:bg-primary-tonal";

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
  const others = day ? loadBlocks(day.blocks).filter((b) => b.kind !== action?.block.kind) : [];
  const emptyLine = day ? emptyBlocksLine(day.blocks) : null;
  const load = day ? dayLoad(day) : 0;
  const dueMistakes = study.mistakes.filter((mistake) => isDueToday(mistake, today));
  // O antigo banner virou o badge "Atrasado" no próprio cartão; ele respeita
  // os mesmos ajustes de aviso de bloco pendente e modo silencioso.
  const lateAlerts = !study.settings.quiet && study.settings.alerts.pending;

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
              late={lateAlerts && isLatePending(action.state, nowMin, studyMin)}
            />
          ) : (
            <RestCard due={dueMistakes.length} allDone={load > 0} />
          )}

          {others.length ? (
            /* 16px entre o cartão acima e o subtítulo: gap de 12px + 4px. */
            <section aria-labelledby="blocos-hoje" className="mt-1 flex flex-col gap-3">
              <h2 id="blocos-hoje" className="text-lg">
                Blocos de hoje
              </h2>
              <ul className="flex flex-col gap-3">
                {others.map((block) => {
                  const state = blockState(study.sessions, day.date, block.kind);
                  return (
                    <BlockCard
                      key={block.kind}
                      date={day.date}
                      block={block}
                      state={state}
                      spent={studiedMinutesFor(study.sessions, day.date, block.kind)}
                      late={lateAlerts && isLatePending(state, nowMin, studyMin)}
                    />
                  );
                })}
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
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm text-fg outline-none data-[highlighted]:bg-surface"
            >
              <FileUp className="size-5 shrink-0" aria-hidden />
              Trocar planilha
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => window.setTimeout(() => window.print(), 0)}
            className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm text-fg outline-none data-[highlighted]:bg-surface"
          >
            <Download className="size-5 shrink-0" aria-hidden />
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
  late,
}: {
  date: string;
  action: { block: PlanBlock; state: "idle" | "active" };
  spent: number;
  hasPackage: boolean;
  late: boolean;
}) {
  const { block, state } = action;
  return (
    <section
      aria-label="Próxima ação"
      className="rounded-xl border border-primary bg-surface-2 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-primary">{KIND_LABEL[block.kind]}</p>
        {late ? <StateChip state="idle" late /> : null}
      </div>
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
        {showsShortSession(state, block.plannedMin) ? (
          <Button variant="ghost" className="text-muted" asChild>
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
  late,
}: {
  date: string;
  block: PlanBlock;
  state: BlockState;
  spent: number;
  late: boolean;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{KIND_LABEL[block.kind]}</p>
          <h3 className="mt-1 text-lg leading-snug">{topicLine(block.content, 110)}</h3>
        </div>
        <StateChip state={state} late={late} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {formatMin(block.plannedMin)}
        {spent > 0 ? ` · ${spent} min estudados` : ""}
      </p>
      <div className="no-print mt-3 flex flex-wrap gap-2">
        <Button className={TONAL_BUTTON} asChild>
          <Link to="/sessao" search={{ dia: date, bloco: block.kind, modo: "cheio", auto: 1 }}>
            {state === "active" ? "Continuar" : state === "done" ? "Reabrir" : "Iniciar"}
          </Link>
        </Button>
      </div>
    </li>
  );
}

function StateChip({ state, late = false }: { state: BlockState; late?: boolean }) {
  const label = state === "active" ? "Em andamento" : state === "done" ? "Concluído" : "Pendente";
  const isLate = state === "idle" && late;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-1 text-xs",
        isLate
          ? "border-clay/50 text-clay-text"
          : state === "active"
            ? "border-primary/50 text-primary"
            : state === "done"
              ? "border-border bg-surface-2 text-muted"
              : "border-border text-muted",
      )}
    >
      {isLate ? "Atrasado" : label}
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
          <Button className={TONAL_BUTTON} onClick={() => startPrep(today)}>
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
