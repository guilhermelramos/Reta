import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/cn";
import type { ErrorReasonKey, ErrorReasonRow, WeakTopic } from "@/lib/study/progress-metrics";

const REASON_COLOR: Record<ErrorReasonKey, string> = {
  lacuna_teorica: "#c4654a",
  atencao: "#e4a04a",
  interpretacao: "#8fb08a",
  tempo: "#7f9bb5",
  sem_causa: "#6b7268",
};

function accuracyTone(accuracy: number): string {
  if (accuracy < 50) return "bg-clay";
  if (accuracy < 75) return "bg-primary/70";
  return "bg-primary";
}

type Props = {
  topics: WeakTopic[];
  reasons: ErrorReasonRow[];
  mistakeCount: number;
};

export function WeakTopicsCard({ topics, reasons, mistakeCount }: Props) {
  const hasReasons = mistakeCount > 0;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">Raio-X de pontos fracos</h2>
          <p className="mt-1 text-xs text-muted">Onde a taxa de acerto está mais baixa — comece por aqui.</p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs tabular-nums text-muted">
          {mistakeCount} {mistakeCount === 1 ? "erro" : "erros"}
        </span>
      </div>

      {topics.length ? (
        <ol className="mt-4 flex flex-col gap-3">
          {topics.map((topic, index) => (
            <li key={topic.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-muted">{index + 1}.</span>
                  <span className="truncate">{topic.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{topic.accuracy}%</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-surface-2" aria-hidden>
                  <div
                    className={cn("h-full rounded-full", accuracyTone(topic.accuracy))}
                    style={{ width: `${Math.max(3, topic.accuracy)}%` }}
                  />
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted">
                  {topic.correct}/{topic.total} certas
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Ainda sem questões respondidas. Faça uma sessão para o raio-X começar a apontar os pontos
          fracos.
        </p>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs text-muted">Motivos de erro</p>
        {hasReasons ? (
          <div className="mt-2 h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={reasons}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
              >
                <XAxis type="number" dataKey="count" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={84}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#b7ae9c", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(228, 160, 74, 0.08)" }}
                  contentStyle={{
                    background: "#1a1f18",
                    border: "1px solid #343c31",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#f3efe4" }}
                  itemStyle={{ color: "#f3efe4" }}
                  formatter={(value) => [`${value}`, "erros"]}
                />
                <Bar dataKey="count" barSize={14} radius={[0, 6, 6, 0]} isAnimationActive={false}>
                  {reasons.map((row) => (
                    <Cell key={row.key} fill={REASON_COLOR[row.key]} />
                  ))}
                  <LabelList dataKey="count" position="right" fill="#b7ae9c" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Nenhum erro no caderno ainda. Ao errar, marque a causa (Teoria, Atenção, Interpretação ou
            Tempo) para o gráfico ganhar forma.
          </p>
        )}
      </div>
    </section>
  );
}
