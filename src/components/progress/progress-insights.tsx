import { useEffect, useMemo, useState } from "react";
import { ConsistencyCard } from "@/components/progress/consistency-card";
import { RetaThermometer } from "@/components/progress/reta-thermometer";
import { WeakTopicsCard } from "@/components/progress/weak-topics-card";
import {
  buildConsistency,
  errorReasonDistribution,
  retaCoverage,
  weakTopicRanking,
} from "@/lib/study/progress-metrics";
import { useStudy } from "@/lib/study/store";
import { saoPauloToday } from "@/lib/study/time";

/**
 * Cartões novos do painel de progresso. Só renderizam depois da montagem: as
 * datas (hoje, últimos 28 dias) são calculadas no cliente, então servidor e
 * primeira renderização do cliente mostram o mesmo esqueleto.
 */
export function ProgressInsights() {
  const { days, sessions, mistakes } = useStudy();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const today = saoPauloToday();

  const consistency = useMemo(
    () => buildConsistency({ days, sessions, today }),
    [days, sessions, today],
  );
  const topics = useMemo(
    () => weakTopicRanking({ days, sessions, mistakes }),
    [days, sessions, mistakes],
  );
  const reasons = useMemo(() => errorReasonDistribution(mistakes), [mistakes]);
  const coverage = useMemo(() => retaCoverage(days, sessions, today), [days, sessions, today]);

  if (!mounted) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <p className="sr-only">Carregando métricas do progresso…</p>
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            aria-hidden
            className="h-36 animate-pulse rounded-2xl border border-border bg-surface/60"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ConsistencyCard summary={consistency} />
      <WeakTopicsCard topics={topics} reasons={reasons} mistakeCount={mistakes.length} />
      <RetaThermometer coverage={coverage} />
    </div>
  );
}
