import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { HeatmapCard } from "@/components/progress/heatmap-card";
import { InsightCard } from "@/components/progress/insight-card";
import { MetricRow } from "@/components/progress/metric-row";
import { PlanDaysCard } from "@/components/progress/plan-days-card";
import { PlanRealCard } from "@/components/progress/plan-real-card";
import {
  buildHeatmap,
  emptyProgressCopy,
  examCountdown,
  firstFoldMetrics,
  planDayRows,
  planVsReal,
  reasonRows,
  weakTopics,
} from "@/lib/study/progress-dashboard";
import { retaCoverage } from "@/lib/study/progress-metrics";
import { useStudy } from "@/lib/study/store";
import { saoPauloToday } from "@/lib/study/time";

export const Route = createFileRoute("/_shell/progresso")({
  head: () => ({ meta: [{ title: "Progresso · Reta" }] }),
  component: ProgressPage,
});

function ProgressPage() {
  const { days, sessions, mistakes } = useStudy();
  const today = useMemo(() => saoPauloToday(), []);

  const countdown = useMemo(() => examCountdown(days, today), [days, today]);
  const metrics = useMemo(
    () => firstFoldMetrics({ days, sessions, today }),
    [days, sessions, today],
  );
  const heatmap = useMemo(() => buildHeatmap({ days, sessions, today }), [days, sessions, today]);
  const realRows = useMemo(() => planVsReal({ days, sessions }), [days, sessions]);
  const topics = useMemo(
    () => weakTopics({ days, sessions, mistakes }),
    [days, sessions, mistakes],
  );
  const reasons = useMemo(() => reasonRows(mistakes), [mistakes]);
  const coverage = useMemo(() => retaCoverage(days, sessions, today), [days, sessions, today]);
  const dayRows = useMemo(() => planDayRows(days, sessions, today), [days, sessions, today]);

  // Sem nenhuma sessão não há o que medir: o estado vazio toma o lugar dos
  // cartões analíticos, mas os dias do plano continuam à vista.
  const empty = sessions.length === 0;

  const topicItems = topics.map((topic) => ({
    key: topic.key,
    label: topic.label,
    value: `${topic.accuracy}%`,
    pct: topic.accuracy,
    tone: topic.accuracy < 50 ? ("clay" as const) : ("primary" as const),
  }));

  const reasonItems = reasons.map((reason) => ({
    key: reason.key,
    label: reason.label,
    value: `${reason.count} ${reason.count === 1 ? "erro" : "erros"} · ${reason.pct}%`,
    pct: reason.pct,
    tone: "primary" as const,
  }));

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-3">
      <header className="pt-1">
        <h1 className="text-3xl leading-tight">Progresso</h1>
        <p className="mt-1 text-sm text-muted">{countdown.label}</p>
      </header>

      {empty ? (
        <>
          <ErrorState copy={emptyProgressCopy()} />
          <PlanDaysCard coverage={coverage} rows={dayRows} />
        </>
      ) : (
        <>
          <MetricRow metrics={metrics} />
          <HeatmapCard heatmap={heatmap} />
          <PlanRealCard rows={realRows} />
          <div className="grid gap-3 min-[520px]:grid-cols-2">
            <InsightCard
              title="Assuntos mais fracos"
              subtitle="Menor taxa de acerto. Toque para abrir o caderno."
              items={topicItems}
              emptyText="Ainda sem questões respondidas. Faça uma sessão para os assuntos aparecerem aqui."
            />
            <InsightCard
              title="Motivos dos erros"
              subtitle="O que mais derruba você nas questões erradas."
              items={reasonItems}
              emptyText="Nenhum erro no caderno ainda. Ao errar, marque a causa para o resumo ganhar forma."
            />
          </div>
          <PlanDaysCard coverage={coverage} rows={dayRows} />
        </>
      )}
    </div>
  );
}
